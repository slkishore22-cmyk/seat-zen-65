import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { grid, layout, shuffleType, conflicts } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // If no conflicts, return empty swaps
    if (!conflicts || conflicts.length === 0) {
      return new Response(JSON.stringify({ swaps: [], explanation: "No conflicts to fix." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = shuffleType === "normal"
      ? `You are an exam seating conflict resolver. You receive a seating grid where students are arranged in columns and rows. 

RULE: In "Normal Shuffle", students from the SAME department should NOT sit side-by-side (horizontally adjacent). Same department students sitting vertically (one behind another in the same sub-column) is ALLOWED and expected.

You receive:
- "grid": array of seats, each with index, rollNumber, groupId, columnIndex, rowIndex, subColumnIndex
- "layout": the room column configuration
- "conflicts": list of seat indices that have horizontal same-department adjacency issues

Your job: suggest SWAPS between seats to eliminate horizontal same-department adjacencies. 
- Only swap rollNumber and groupId between two seats (keep seat positions fixed)
- Minimize the number of swaps
- Never remove or add students
- Only fix the specific conflicts listed
- Prefer swapping a conflicting seat with a non-conflicting seat from a DIFFERENT row or column that won't create new conflicts`

      : `You are an exam seating conflict resolver. You receive a seating grid where students are arranged for maximum anti-copying security.

RULE: In "University Shuffle", NO two adjacent students (horizontally OR vertically) should be from the same department.

You receive:
- "grid": array of seats, each with index, rollNumber, groupId, columnIndex, rowIndex, subColumnIndex  
- "layout": the room column configuration
- "conflicts": list of seat indices that have same-department adjacency issues (horizontal or vertical)

Your job: suggest SWAPS between seats to eliminate ALL same-department adjacencies (horizontal AND vertical).
- Only swap rollNumber and groupId between two seats (keep seat positions fixed)
- Minimize the number of swaps
- Never remove or add students
- Only fix the specific conflicts listed
- Prefer swapping a conflicting seat with a non-conflicting seat that won't create new conflicts`;

    // Compact the grid - only send occupied seats with essential info
    const compactGrid = grid
      .map((s: any, i: number) => s.rollNumber ? { i, r: s.rollNumber, g: s.groupId, c: s.columnIndex, row: s.rowIndex, sc: s.subColumnIndex } : null)
      .filter(Boolean);

    const userPrompt = `Here is the seating grid (occupied seats only):
${JSON.stringify(compactGrid)}

Layout (columns config): ${JSON.stringify(layout)}

Conflict seat indices: ${JSON.stringify(conflicts)}

Please suggest swaps to fix these conflicts. Each swap exchanges the student (rollNumber + groupId) between two seat indices.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "apply_swaps",
              description: "Apply seat swaps to fix conflicts in the seating arrangement",
              parameters: {
                type: "object",
                properties: {
                  swaps: {
                    type: "array",
                    description: "Array of swap operations. Each swap exchanges students between two seat indices.",
                    items: {
                      type: "object",
                      properties: {
                        fromIndex: { type: "number", description: "First seat index to swap" },
                        toIndex: { type: "number", description: "Second seat index to swap" },
                      },
                      required: ["fromIndex", "toIndex"],
                    },
                  },
                  explanation: { type: "string", description: "Brief explanation of what was fixed" },
                },
                required: ["swaps", "explanation"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "apply_swaps" } },
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
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ swaps: [], explanation: "AI could not determine swaps" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);

    // Validate swaps - ensure indices are within bounds
    const validSwaps = (result.swaps || []).filter((s: any) =>
      typeof s.fromIndex === "number" && typeof s.toIndex === "number" &&
      s.fromIndex >= 0 && s.toIndex >= 0 &&
      s.fromIndex < grid.length && s.toIndex < grid.length &&
      s.fromIndex !== s.toIndex
    );

    return new Response(JSON.stringify({ swaps: validSwaps, explanation: result.explanation || "" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-fix-conflicts error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
