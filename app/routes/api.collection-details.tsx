// import type { ActionFunctionArgs } from "@remix-run/node";
// import { json } from "@remix-run/node";
// import { getCollectionsByIds } from "../services/api.graphql";

// export const action = async ({ request }: ActionFunctionArgs) => {
//   if (request.method !== "POST") {
//     return json({ error: "Method not allowed" }, { status: 405 });
//   }

//   try {
//     const { collectionIds } = await request.json();

//     if (!collectionIds || !Array.isArray(collectionIds)) {
//       return json({ error: "Collection IDs are required" }, { status: 400 });
//     }

//     const collections = await getCollectionsByIds(request, collectionIds);

//     return json({
//       collections,
//       success: true,
//     });
//   } catch (error) {
//     console.error("Error in collection details API:", error);
//     return json(
//       { 
//         error: "Failed to fetch collection details",
//         collections: [],
//         success: false,
//       },
//       { status: 500 }
//     );
//   }
// };
