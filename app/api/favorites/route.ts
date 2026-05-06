// app/api/favorites/route.ts
// CRUD endpoint for user favorites.
// GET    → List user's favorites
// POST   → Add a favorite
// DELETE → Remove a favorite (pass ?id=UUID)
//
// v6.3.1 (audit Phase C part 2): now uses a user-scoped Supabase client built
// from the caller's Bearer JWT. RLS is the primary auth boundary — the
// previous .eq("user_id", user.id) filters are removed because the policies
// (auth.uid() = user_id) handle them automatically. Service-role is no longer
// imported here.

import { NextRequest, NextResponse } from "next/server";
import { createUserClient, getBearerToken } from "@/lib/supabase-user";

async function authedClient(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) return null;
  const supa = createUserClient(token);
  // Validate the JWT and get user.id (used as the value we set on inserts).
  const { data: { user }, error } = await supa.auth.getUser();
  if (error || !user) return null;
  return { supa, user };
}

// GET /api/favorites — list all favorites for the authenticated user
export async function GET(req: NextRequest) {
  const ctx = await authedClient(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // No .eq("user_id", ...) — RLS policy "Users can view own favorites" enforces it.
  const { data, error } = await ctx.supa
    .from("favorites")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Favorites fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch favorites" }, { status: 500 });
  }

  return NextResponse.json({ favorites: data });
}

// POST /api/favorites — add a movie to favorites.
// Optional folder_id routes the favorite into a specific folder; null/missing
// → Unsorted. Folder ownership is now enforced by RLS — the SELECT below
// only returns folders the caller owns, so an attempt to slot the favorite
// into someone else's folder returns 404.
export async function POST(req: NextRequest) {
  const ctx = await authedClient(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, year, genre, poster_url, score_ten, score_stars, search_key, folder_id } = body;

  if (!title || !search_key) {
    return NextResponse.json({ error: "title and search_key are required" }, { status: 400 });
  }

  let validatedFolderId: string | null = null;
  if (folder_id) {
    const { data: folderRow, error: folderErr } = await ctx.supa
      .from("favorite_folders")
      .select("id")
      .eq("id", folder_id)
      .single();
    if (folderErr || !folderRow) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }
    validatedFolderId = folderRow.id;
  }

  const { data, error } = await ctx.supa
    .from("favorites")
    .upsert(
      {
        user_id: ctx.user.id,  // CHECK policy enforces this matches auth.uid()
        title: String(title).slice(0, 500),
        year: year ? Number(year) : null,
        genre: genre ? String(genre).slice(0, 200) : null,
        poster_url: poster_url ? String(poster_url).slice(0, 1000) : null,
        score_ten: score_ten ? Number(score_ten) : null,
        score_stars: score_stars ? Number(score_stars) : null,
        search_key: String(search_key).toLowerCase().slice(0, 500),
        folder_id: validatedFolderId,
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

// DELETE /api/favorites?id=UUID — remove a favorite.
// RLS DELETE policy ensures only the owner can delete; the explicit
// .eq("user_id", ...) is no longer required.
export async function DELETE(req: NextRequest) {
  const ctx = await authedClient(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id parameter is required" }, { status: 400 });
  }

  const { error } = await ctx.supa.from("favorites").delete().eq("id", id);

  if (error) {
    console.error("Favorite delete error:", error);
    return NextResponse.json({ error: "Failed to delete favorite" }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
