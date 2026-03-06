import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, roomCount } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an exam room layout configuration assistant. The user will describe room layouts in natural language and you must convert them into structured configurations.

You have ${roomCount} room(s) to configure. Each room has "columns" (physical column groups in the room). Each column has:
- "subColumns": number of seats side-by-side in that column (1-6)
- "rows": number of rows in that column (1-50)

Common patterns:
- "3 columns, 2 seats each, 10 rows" → 3 columns each with subColumns=2, rows=10
- "typical classroom for 60 students" → figure out a reasonable layout (e.g., 3 columns × 2 sub-cols × 10 rows = 60)
- "hall with 4 wide columns and 8 rows" → 4 columns, subColumns=3-4, rows=8
- "small room 20 seats" → e.g., 2 columns × 2 sub-cols × 5 rows
- "Room 1: 3x10 with 2 seats, Room 2: 4x8 with 3 seats" → different configs per room

If the user mentions specific rooms by number, configure those rooms specifically. If they give a general description, apply it to all rooms.

Each room can also have an optional "name" (string, like "Hall A" or "Room 101").`;

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
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "configure_rooms",
              description: "Configure the room layouts based on the user's description",
              parameters: {
                type: "object",
                properties: {
                  rooms: {
                    type: "array",
                    description: "Array of room configurations, one per room",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Optional room name like 'Hall A'" },
                        columns: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              subColumns: { type: "number", description: "Seats per row in this column (1-6)" },
                              rows: { type: "number", description: "Number of rows (1-50)" },
                            },
                            required: ["subColumns", "rows"],
                          },
                        },
                      },
                      required: ["columns"],
                    },
                  },
                  explanation: { type: "string", description: "Brief explanation of the layout chosen" },
                },
                required: ["rooms", "explanation"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "configure_rooms" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Could not parse room layout from description" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);

    // Validate and clamp values
    for (const room of result.rooms) {
      for (const col of room.columns) {
        col.subColumns = Math.max(1, Math.min(6, Math.round(col.subColumns)));
        col.rows = Math.max(1, Math.min(50, Math.round(col.rows)));
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-room-config error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
