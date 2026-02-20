// app/api/favorites/route.ts
// CRUD endpoint for user favorites.
// GET  → List user's favorites
// POST → Add a favorite
// DELETE → Remove a favorite (pass ?id=UUID)

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

async function getUser(req: NextRequest) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(auth.split(" ")[1]);
  if (error || !user) return null;
  return user;
}

// GET /api/favorites — list all favorites for the authenticated user
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("favorites")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Favorites fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch favorites" }, { status: 500 });
  }

  return NextResponse.json({ favorites: data });
}

// POST /api/favorites — add a movie to favorites
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, year, genre, poster_url, score_ten, score_stars, search_key } = body;

  if (!title || !search_key) {
    return NextResponse.json({ error: "title and search_key are required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("favorites")
    .upsert(
      {
        user_id: user.id,
        title: String(title).slice(0, 500),
        year: year ? Number(year) : null,
        genre: genre ? String(genre).slice(0, 200) : null,
        poster_url: poster_url ? String(poster_url).slice(0, 1000) : null,
        score_ten: score_ten ? Number(score_ten) : null,
        score_stars: score_stars ? Number(score_stars) : null,
        search_key: String(search_key).toLowerCase().slice(0, 500),
      },
      { onConflict: "user_id,title,year" }
    )
    .select()
    .single();

  if (error) {
    console.error("Favorite insert error:", error);
    return NextResponse.json({ error: "Failed to save favorite" }, { status: 500 });
  }

  return NextResponse.json({ favorite: data }, { status: 201 });
}

// DELETE /api/favorites?id=UUID — remove a favorite
export async function DELETE(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id parameter is required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("favorites")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id); // RLS safety: ensure user owns this favorite

  if (error) {
    console.error("Favorite delete error:", error);
    return NextResponse.json({ error: "Failed to delete favorite" }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
