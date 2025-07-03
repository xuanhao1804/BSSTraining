// import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
// import { json } from "@remix-run/node";
// import { authenticate } from "../shopify.server";
// import { getProductsByIds } from "../services/api.graphql";

// // Support both GET and POST
// export const loader = async ({ request }: LoaderFunctionArgs) => {
//   return action({ request } as ActionFunctionArgs);
// };

// export const action = async ({ request }: ActionFunctionArgs) => {
//   try {
//     await authenticate.admin(request);
//   } catch (authError) {
//     return json({
//       success: false,
//       error: "Authentication failed",
//     }, { status: 401 });
//   }

//   let body;
//   try {
//     body = await request.json();
//   } catch (parseError) {
//     return json({
//       success: false,
//       error: "Invalid request body",
//     }, { status: 400 });
//   }
  
//   const { productIds } = body;

//   try {
//     if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
//       return json({
//         success: true,
//         products: [],
//         count: 0,
//       });
//     }

//     const products = await getProductsByIds(request, productIds);
    
//     return json({
//       success: true,
//       products,
//       count: products.length,
//     });

//   } catch (error: any) {
//     console.error("Product Details API Error:", error);
//     console.error("Error stack:", error.stack);
    
//     // Handle specific GraphQL errors
//     if (error.message && error.message.includes('410')) {
//       return json({
//         success: true,
//         products: [],
//         count: 0,
//       });
//     }
    
//     return json({
//       success: false,
//       error: "Failed to fetch product details",
//       message: error.message || "Unknown error",
//     }, { status: 500 });
//   }
// };
