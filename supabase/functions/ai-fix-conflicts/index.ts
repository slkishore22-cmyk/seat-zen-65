import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an exam seating arrangement validator.

You receive a completed seating grid and must fix only horizontal conflicts.

UNDERSTAND THE GRID STRUCTURE FIRST:

The grid is a flat array of seat objects. Each seat has: columnIndex, rowIndex, subColumnIndex, rollNumber, groupId, color, hex.

Columns are the main physical columns in the room.
Rows are the horizontal rows of seats (R1, R2...).
SubColumns are the individual seat positions within each row inside one column.

WHAT IS CORRECT — NEVER CHANGE THIS:

Same department students sitting in the SAME subColumn across different rows is CORRECT.

Example:
  Col1 R1 SC1: 23A001  ← correct
  Col1 R2 SC1: 23A002  ← correct, same dept below
  Col1 R3 SC1: 23A003  ← correct, same dept below

This is the intended back-to-back vertical pattern.
Do NOT treat this as a conflict.
Do NOT move these students.

WHAT IS A CONFLICT — ONLY FIX THIS:

Two seats with the same groupId that are in the SAME row AND directly next to each other in adjacent subColumns.

Example:
  Col1 R1 SC1: 23A001  ← conflict
  Col1 R1 SC2: 23A007  ← conflict, same dept beside

These two are side by side horizontally.
This is the ONLY thing you must fix.

HOW TO FIX A CONFLICT:

Step 1: Scan every row in every column.
Step 2: Find any two adjacent seats (SC and SC+1) in the same row that share the same groupId.
Step 3: For the second seat (SC+1), find a SWAP CANDIDATE anywhere in the entire grid that:
  - Has a different groupId than the conflict seat
  - Has a different groupId than its own left neighbor
  - Has a different groupId than its own right neighbor
  - Has a different groupId than the first conflict seat
Step 4: Swap the two seats (swap rollNumber, groupId, color, hex).
Step 5: Scan again from the beginning.
Step 6: Repeat maximum 200 times then stop.

WHEN NO PERFECT SWAP EXISTS:

If after searching the entire grid no perfect swap candidate exists for a conflict seat, find the BEST candidate — the one that creates the fewest new conflicts after swapping.
Always swap even if imperfect.
Never leave a conflict unfixed if any swap helps.

ABSOLUTE RULES THAT CANNOT BE BROKEN:

1. Never remove any student from the grid.
2. Never add any student to the grid.
3. Never leave any seat empty that was filled.
4. Never fill any seat that was empty.
5. Total student count before must equal after.
6. Every rollNumber must appear exactly once.
7. No student can appear twice.
8. Do not change groupId assignments — if you move 23A001 to a new position, its groupId stays the same.

VERIFY BEFORE RETURNING:

Count total non-empty seats in output.
Must equal total non-empty seats in input.
If not equal, you made an error — fix it.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { grid, layout, groups, conflicts, conflictPositions, totalStudents } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!conflicts || conflicts.length === 0) {
      return new Response(JSON.stringify({ fixedGrid: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = `Current grid with conflicts:
${JSON.stringify(grid)}

Group definitions:
${JSON.stringify(groups)}

Total students: ${totalStudents}

Conflict positions: ${JSON.stringify(conflictPositions)}

Return ONLY the fixed grid as a valid JSON array. Same structure as the input grid. No explanation. No markdown. No code blocks. Just the raw JSON array starting with [ and ending with ].`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ fixedGrid: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract JSON array from response (strip markdown fences if present)
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }

    try {
      const fixedGrid = JSON.parse(jsonStr);
      if (!Array.isArray(fixedGrid)) {
        console.error("AI response is not an array");
        return new Response(JSON.stringify({ fixedGrid: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Server-side validation: count filled seats
      const originalFilled = grid.filter((s: any) => s.rollNumber).length;
      const fixedFilled = fixedGrid.filter((s: any) => s.rollNumber).length;

      if (originalFilled !== fixedFilled) {
        console.error(`Seat count mismatch: original=${originalFilled}, fixed=${fixedFilled}`);
        return new Response(JSON.stringify({ fixedGrid: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ fixedGrid }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (parseErr) {
      console.error("Failed to parse AI response as JSON:", parseErr);
      return new Response(JSON.stringify({ fixedGrid: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("ai-fix-conflicts error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
