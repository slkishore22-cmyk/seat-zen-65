import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { grid, layout, shuffleType, conflicts, groups } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!conflicts || conflicts.length === 0) {
      return new Response(JSON.stringify({ swaps: [], explanation: "No conflicts to fix." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an exam seating conflict resolver.

You follow ONLY these rules. No other rules. No assumptions.

RULE 1: Same department students sit vertically back to back in the same sub-column. This is CORRECT. Do not change this. Do not treat vertical same-dept as a conflict.

RULE 2: Same department students must never sit side by side horizontally in the same row. This is the ONLY conflict to fix.

HOW TO FIX: Find two seats in the same row that have the same department next to each other. Find any other seat in the entire grid that has a different department. Swap them. Repeat until no horizontal conflicts remain. Maximum 100 swap attempts then stop.

RULE 3 — NEVER BREAK: Never leave any seat empty. Never create overflow. Every student must be placed. If no perfect swap exists, place the student anyway even if it creates a conflict.`;

    const compactGrid = grid
      .map((s: any, i: number) => s.rollNumber ? { i, r: s.rollNumber, g: s.groupId, c: s.columnIndex, row: s.rowIndex, sc: s.subColumnIndex } : null)
      .filter(Boolean);

    const userPrompt = `Fix horizontal same-dept conflicts only.
Vertical same-dept is correct, do not touch.
Never leave empty seats.
Grid: ${JSON.stringify(compactGrid)}
Groups: ${JSON.stringify(groups)}
Layout: ${JSON.stringify(layout)}
Conflict seat indices: ${JSON.stringify(conflicts)}
Return only the fixed grid as JSON.`;

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
              description: "Apply seat swaps to fix horizontal same-department conflicts. Max 100 swaps.",
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

    const validSwaps = (result.swaps || []).filter((s: any) =>
      typeof s.fromIndex === "number" && typeof s.toIndex === "number" &&
      s.fromIndex >= 0 && s.toIndex >= 0 &&
      s.fromIndex < grid.length && s.toIndex < grid.length &&
      s.fromIndex !== s.toIndex
    ).slice(0, 100); // Max 100 swaps

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
