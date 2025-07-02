import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { getAllProductTags } from "../utils/api.graphql";

// Simple in-memory cache
const cache = new Map<string, { data: string[], timestamp: number }>();
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const url = new URL(request.url);
    const searchTerm = url.searchParams.get("search") || "";
    const cacheKey = `tags_${searchTerm}`;

    // Check cache first
    const cachedData = cache.get(cacheKey);
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
      return json({ 
        success: true, 
        tags: cachedData.data,
        fromCache: true
      });
    }

    const tags = await getAllProductTags(request, searchTerm);
    
    // Cache the result
    cache.set(cacheKey, {
      data: tags,
      timestamp: Date.now()
    });

    return json({ 
      success: true, 
      tags: tags,
      fromCache: false
    });
  } catch (error) {
    console.error("Error in tags API:", error);
    return json({ 
      success: false, 
      error: "Failed to fetch tags",
      tags: []
    }, { status: 500 });
  }
};
