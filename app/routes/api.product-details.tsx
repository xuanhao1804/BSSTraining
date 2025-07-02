import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getProductsByIds } from "../utils/api.graphql";

// Support both GET and POST
export const loader = async ({ request }: LoaderFunctionArgs) => {
  return action({ request } as ActionFunctionArgs);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  console.log("=== PRODUCT DETAILS API DEBUG ===");
  console.log("Request method:", request.method);
  console.log("Request URL:", request.url);
  
  try {
    await authenticate.admin(request);
    console.log("Authentication successful");
  } catch (authError) {
    console.log("Authentication failed:", authError);
    return json({
      success: false,
      error: "Authentication failed",
    }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
    console.log("Request body:", body);
  } catch (parseError) {
    console.log("Failed to parse request body:", parseError);
    return json({
      success: false,
      error: "Invalid request body",
    }, { status: 400 });
  }
  
  const { productIds } = body;

  try {
    console.log("ProductIds received:", productIds);
    
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      console.log("No valid productIds, returning empty array");
      return json({
        success: true,
        products: [],
        count: 0,
      });
    }

    console.log("Calling getProductsByIds with:", productIds);
    const products = await getProductsByIds(request, productIds);
    console.log("Products received from GraphQL:", products);
    
    return json({
      success: true,
      products,
      count: products.length,
    });

  } catch (error: any) {
    console.error("Product Details API Error:", error);
    console.error("Error stack:", error.stack);
    
    // Handle specific GraphQL errors
    if (error.message && error.message.includes('410')) {
      return json({
        success: true,
        products: [],
        count: 0,
      });
    }
    
    return json({
      success: false,
      error: "Failed to fetch product details",
      message: error.message || "Unknown error",
    }, { status: 500 });
  }
};
