import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getAllProductTags } from "../services/api.graphql";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Get shop from authenticated session instead of params
    const { session } = await authenticate.admin(request);
    
    if (!session.shop) {
      return json({ success: false, error: "No shop in session" }, { status: 400 });
    }

    const url = new URL(request.url);
    const search = url.searchParams.get("search");

    // Find shop in database
    const dbShop = await prisma.shop.findUnique({ 
      where: { shop: session.shop } 
    });
    
    if (!dbShop) {
      return json({ success: false, error: "Shop not authorized" }, { status: 401 });
    }

    // Extract shop name for API call
    const safeSearch = search === null ? undefined : search;
    
    const tags = await getAllProductTags(session.shop, dbShop.accessToken, safeSearch);
    
    return json({ success: true, tags });
  } catch (err) {
    console.error("❌ Fetch tags failed:", err);
    
    return json({ success: false, error: "Failed to fetch tags" }, { status: 500 });
  }
};