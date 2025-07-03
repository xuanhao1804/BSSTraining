import { authenticate } from "../shopify.server";

export async function getAllProductTags(shop: string, accessToken: string, searchTerm?: string) {
  // Shopify GraphQL endpoint
  const endpoint = `https://${shop}/admin/api/2025-01/graphql.json`;  

  const query = searchTerm ? `
    query GetProductTagsWithSearch($cursor: String, $query: String) {
      products(first: 100, after: $cursor, query: $query) {
        pageInfo { hasNextPage }
        edges { cursor node { tags } }
      }
    }
  ` : `
    query GetAllProductTags($cursor: String) {
      products(first: 250, after: $cursor) {
        pageInfo { hasNextPage }
        edges { cursor node { tags } }
      }
    }
  `;

  let allTags = new Set<string>();
  let cursor: string | null = null;
  let hasNextPage = true;
  let pagesProcessed = 0;
  const maxPages = searchTerm ? 3 : 10;

  while (hasNextPage && pagesProcessed < maxPages) {
    const variables: any = { cursor };
    if (searchTerm) variables.query = `tag:*${searchTerm}*`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables })
    });

    const data = await response.json();
    if (data.errors) throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);

    data.data.products.edges.forEach((edge: any) => {
      edge.node.tags.forEach((tag: string) => allTags.add(tag.trim()));
    });

    hasNextPage = data.data.products.pageInfo.hasNextPage;
    cursor = hasNextPage ? data.data.products.edges.slice(-1)[0].cursor : null;
    pagesProcessed++;
  }

  return Array.from(allTags).slice(0, 20);
}


// Get all products with pricing information
export async function getAllProductsWithPricing(shop: string, accessToken: string, limit = 50) {
  const endpoint = `https://${shop}/admin/api/2025-01/graphql.json`;

  const query = `
    query GetAllProductsWithPricing($first: Int!, $cursor: String) {
      products(first: $first, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            id title handle tags
            featuredImage { url altText }
            variants(first: 10) {
              edges {
                node { id title price compareAtPrice sku }
              }
            }
          }
        }
      }
    }
  `;

  let cursor: string | null = null;
  let hasNextPage = true;
  let allProducts: any[] = [];
  let pagesProcessed = 0;

  while (hasNextPage && pagesProcessed < 10) {
    const variables = { first: limit, cursor }as Record<string, any>;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });
    const data = await response.json();

    if (data.errors) throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);

    allProducts.push(...data.data.products.edges.map((edge: any) => ({
      id: edge.node.id,
      title: edge.node.title,
      handle: edge.node.handle,
      tags: edge.node.tags,
      featuredImage: edge.node.featuredImage,
      variants: edge.node.variants.edges.map((variantEdge: any) => ({
        id: variantEdge.node.id,
        title: variantEdge.node.title,
        price: variantEdge.node.price,
        compareAtPrice: variantEdge.node.compareAtPrice,
        sku: variantEdge.node.sku,
      }))
    })));

    hasNextPage = data.data.products.pageInfo.hasNextPage;
    cursor = data.data.products.pageInfo.endCursor;
    pagesProcessed++;
  }

  return allProducts;
}


// Get specific products by IDs with pricing information
export async function getProductsByIdsWithPricing(shop: string, accessToken: string, productIds: string[]) {
  const endpoint = `https://${shop}/admin/api/2025-01/graphql.json`;

  const query = `
    query GetProductsByIdsWithPricing($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Product {
          id title handle tags
          featuredImage { url altText }
          variants(first: 10) {
            edges { node { id title price compareAtPrice sku } }
          }
        }
      }
    }
  `;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables: { ids: productIds } }),
  });
  const data = await response.json();
  if (data.errors) throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);

  return data.data.nodes
    .filter((node: any) => node && node.id)
    .map((node: any) => ({
      id: node.id,
      title: node.title,
      handle: node.handle,
      tags: node.tags,
      featuredImage: node.featuredImage,
      variants: node.variants.edges.map((variantEdge: any) => ({
        id: variantEdge.node.id,
        title: variantEdge.node.title,
        price: variantEdge.node.price,
        compareAtPrice: variantEdge.node.compareAtPrice,
        sku: variantEdge.node.sku,
      }))
    }));
}


// Get products by collection IDs
export async function getProductsByCollectionIdsWithPricing(shop: string, accessToken: string, collectionIds: string[]) {
  const endpoint = `https://${shop}/admin/api/2025-01/graphql.json`;

  const query = `
    query GetProductsByCollectionIdsWithPricing($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Collection {
          id title
          products(first: 50) {
            edges {
              node {
                id title handle tags
                featuredImage { url altText }
                variants(first: 10) {
                  edges { node { id title price compareAtPrice sku } }
                }
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables: { ids: collectionIds } }),
  });
  const data = await response.json();
  if (data.errors) throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);

  const productsMap = new Map();
  data.data.nodes
    .filter((node: any) => node && node.id)
    .forEach((collection: any) => {
      collection.products.edges.forEach((edge: any) => {
        const product = {
          id: edge.node.id,
          title: edge.node.title,
          handle: edge.node.handle,
          tags: edge.node.tags,
          featuredImage: edge.node.featuredImage,
          variants: edge.node.variants.edges.map((variantEdge: any) => ({
            id: variantEdge.node.id,
            title: variantEdge.node.title,
            price: variantEdge.node.price,
            compareAtPrice: variantEdge.node.compareAtPrice,
            sku: variantEdge.node.sku,
          }))
        };
        productsMap.set(product.id, product);
      });
    });

  return Array.from(productsMap.values());
}


// Get products by tags
export async function getProductsByTagsWithPricing(shop: string, accessToken: string, tags: string[]) {
  const endpoint = `https://${shop}/admin/api/2025-01/graphql.json`;
  const tagQuery = tags.map(tag => `tag:${tag}`).join(' OR ');

  const query = `
    query GetProductsByTagsWithPricing($query: String!, $first: Int!, $cursor: String) {
      products(query: $query, first: $first, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            id title handle tags
            featuredImage { url altText }
            variants(first: 10) {
              edges { node { id title price compareAtPrice sku } }
            }
          }
        }
      }
    }
  `;

  let cursor: string | null = null;
  let hasNextPage = true;
  let allProducts: any[] = [];
  let pagesProcessed = 0;

  while (hasNextPage && pagesProcessed < 5) {
    const variables = { query: tagQuery, first: 50, cursor }as Record<string, any>;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });
    const data = await response.json();
    if (data.errors) throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);

    allProducts.push(...data.data.products.edges.map((edge: any) => ({
      id: edge.node.id,
      title: edge.node.title,
      handle: edge.node.handle,
      tags: edge.node.tags,
      featuredImage: edge.node.featuredImage,
      variants: edge.node.variants.edges.map((variantEdge: any) => ({
        id: variantEdge.node.id,
        title: variantEdge.node.title,
        price: variantEdge.node.price,
        compareAtPrice: variantEdge.node.compareAtPrice,
        sku: variantEdge.node.sku,
      }))
    })));

    hasNextPage = data.data.products.pageInfo.hasNextPage;
    cursor = data.data.products.pageInfo.endCursor;
    pagesProcessed++;
  }

  return allProducts;
}


// Get collection details by IDs
export async function getCollectionsByIds(request: Request, collectionIds: string[]) {
  const { admin } = await authenticate.admin(request);

  const query = `
    query GetCollectionsByIds($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Collection {
          id
          title
          handle
          description
          image {
            url
            altText
          }
        }
      }
    }
  `;

  try {
    const response = await admin.graphql(query, {
      variables: { ids: collectionIds }
    });

    const data: any = await response.json();
    
    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    return data.data.nodes
      .filter((node: any) => node && node.id) // Filter out null nodes
      .map((node: any) => ({
        id: node.id,
        title: node.title,
        handle: node.handle,
        description: node.description,
        image: node.image,
      }));

  } catch (error) {
    console.error("Error fetching collections by IDs:", error);
    throw new Error("Failed to fetch collections by IDs");
  }
}

// Get products by variant IDs with pricing information
export async function getProductsByVariantIdsWithPricing(request: Request, variantIds: string[]) {
  const { admin } = await authenticate.admin(request);

  // Build query for variants and their parent products
  const query = `
    query GetProductsByVariantIdsWithPricing($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on ProductVariant {
          id
          title
          price
          compareAtPrice
          sku
          product {
            id
            title
            handle
            tags
            featuredImage {
              url
              altText
            }
            variants(first: 10) {
              edges {
                node {
                  id
                  title
                  price
                  compareAtPrice
                  sku
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await admin.graphql(query, {
      variables: { ids: variantIds }
    });

    const data: any = await response.json();
    
    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    // Group variants by product and merge
    const productMap = new Map();
    
    data.data.nodes
      .filter((node: any) => node && node.id) // Filter out null nodes
      .forEach((variantNode: any) => {
        const product = variantNode.product;
        if (!productMap.has(product.id)) {
          productMap.set(product.id, {
            id: product.id,
            title: product.title,
            handle: product.handle,
            tags: product.tags,
            featuredImage: product.featuredImage,
            variants: product.variants.edges.map((variantEdge: any) => ({
              id: variantEdge.node.id,
              title: variantEdge.node.title,
              price: variantEdge.node.price,
              compareAtPrice: variantEdge.node.compareAtPrice,
              sku: variantEdge.node.sku,
            })),
            // Mark which variants were specifically selected
            selectedVariants: []
          });
        }
        
        // Add this variant to the selectedVariants array
        productMap.get(product.id).selectedVariants.push({
          id: variantNode.id,
          title: variantNode.title,
          price: variantNode.price,
          compareAtPrice: variantNode.compareAtPrice,
          sku: variantNode.sku,
        });
      });

    return Array.from(productMap.values());

  } catch (error) {
    console.error("Error fetching products by variant IDs with pricing:", error);
    throw new Error("Failed to fetch products by variant IDs with pricing");
  }
}

// Get specific products by IDs for form display (simple version, no pricing)
export async function getProductsByIds(request: Request, productIds: string[]) {
  const { admin } = await authenticate.admin(request);

  const query = `
    query GetProductsByIds($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Product {
          id
          title
          handle
          featuredImage {
            url
            altText
          }
        }
      }
    }
  `;

  try {
    const response = await admin.graphql(query, {
      variables: { ids: productIds }
    });

    const data: any = await response.json();
    
    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    const products = data.data.nodes
      .filter((node: any) => node && node.id) // Filter out null nodes (deleted products)
      .map((node: any) => ({
        id: node.id,
        title: node.title,
        handle: node.handle,
        featuredImage: node.featuredImage,
      }));
    
    return products;

  } catch (error) {
    console.error("Error fetching products by IDs:", error);
    throw new Error("Failed to fetch products by IDs");
  }
}
