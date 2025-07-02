import { authenticate } from "../shopify.server";

export async function getAllProductTags(request: Request, searchTerm?: string) {
  const { admin } = await authenticate.admin(request);

  // Use different query strategies based on whether we have a search term
  const query = searchTerm ? `
    query GetProductTagsWithSearch($cursor: String, $query: String) {
      products(first: 100, after: $cursor, query: $query) {
        pageInfo {
          hasNextPage
        }
        edges {
          cursor
          node {
            tags
          }
        }
      }
    }
  ` : `
    query GetAllProductTags($cursor: String) {
      products(first: 250, after: $cursor) {
        pageInfo {
          hasNextPage
        }
        edges {
          cursor
          node {
            tags
          }
        }
      }
    }
  `;

  try {
    let allTags = new Set<string>();
    let cursor: string | null = null;
    let hasNextPage = true;
    let pagesProcessed = 0;
    const maxPages = searchTerm ? 3 : 10; // Limit pages when searching

    // Fetch products with pagination
    while (hasNextPage && pagesProcessed < maxPages) {
      const variables: any = { cursor };
      
      // Add search query if provided - search for products with tags containing the term
      if (searchTerm) {
        variables.query = `tag:*${searchTerm}*`;
      }

      const response: any = await admin.graphql(query, { variables });
      const data: any = await response.json();
      
      if (data.data?.products?.edges) {
        // Extract tags from each product
        data.data.products.edges.forEach((edge: any) => {
          edge.node.tags.forEach((tag: string) => {
            if (tag && tag.trim()) {
              allTags.add(tag.trim());
            }
          });
        });

        // Update pagination info
        const pageInfo = data.data.products.pageInfo;
        hasNextPage = pageInfo.hasNextPage;
        
        if (hasNextPage && data.data.products.edges.length > 0) {
          cursor = data.data.products.edges[data.data.products.edges.length - 1].cursor;
        }

        pagesProcessed++;

        // Early break if we have enough tags matching search term
        if (searchTerm && allTags.size >= 50) {
          break;
        }
      } else {
        hasNextPage = false;
      }
    }

    // Convert Set to Array and filter by search term if provided
    let tagsArray = Array.from(allTags);
    
    if (searchTerm && searchTerm.trim()) {
      const searchLower = searchTerm.trim().toLowerCase();
      tagsArray = tagsArray.filter(tag => {
        const tagLower = tag.toLowerCase();
        // Priority: exact match -> starts with -> contains
        return tagLower === searchLower || 
               tagLower.startsWith(searchLower) || 
               tagLower.includes(searchLower);
      });
      
      // Sort by relevance: exact match first, then starts with, then contains
      tagsArray.sort((a, b) => {
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        
        if (aLower === searchLower && bLower !== searchLower) return -1;
        if (bLower === searchLower && aLower !== searchLower) return 1;
        if (aLower.startsWith(searchLower) && !bLower.startsWith(searchLower)) return -1;
        if (bLower.startsWith(searchLower) && !aLower.startsWith(searchLower)) return 1;
        
        return a.localeCompare(b);
      });
    } else {
      // Sort alphabetically when no search term
      tagsArray.sort((a, b) => a.localeCompare(b));
    }

    // Limit to 20 results for performance
    return tagsArray.slice(0, 20);

  } catch (error) {
    console.error("Error fetching product tags:", error);
    throw new Error("Failed to fetch product tags");
  }
}

// Get all products with pricing information
export async function getAllProductsWithPricing(request: Request, limit: number = 50) {
  const { admin } = await authenticate.admin(request);

  const query = `
    query GetAllProductsWithPricing($first: Int!, $cursor: String) {
      products(first: $first, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
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
      variables: { first: limit }
    });

    const data: any = await response.json();
    
    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    return data.data.products.edges.map((edge: any) => ({
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
    }));

  } catch (error) {
    console.error("Error fetching all products with pricing:", error);
    throw new Error("Failed to fetch products with pricing");
  }
}

// Get specific products by IDs with pricing information
export async function getProductsByIdsWithPricing(request: Request, productIds: string[]) {
  const { admin } = await authenticate.admin(request);

  // Build query for multiple products by ID
  const query = `
    query GetProductsByIdsWithPricing($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Product {
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
  `;

  try {
    const response = await admin.graphql(query, {
      variables: { ids: productIds }
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

  } catch (error) {
    console.error("Error fetching products by IDs with pricing:", error);
    throw new Error("Failed to fetch products by IDs with pricing");
  }
}

// Get products by collection IDs with pricing information
export async function getProductsByCollectionIdsWithPricing(request: Request, collectionIds: string[]) {
  const { admin } = await authenticate.admin(request);

  const query = `
    query GetProductsByCollectionIdsWithPricing($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Collection {
          id
          title
          products(first: 50) {
            edges {
              node {
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

    // Flatten products from all collections and remove duplicates
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

  } catch (error) {
    console.error("Error fetching products by collection IDs with pricing:", error);
    throw new Error("Failed to fetch products by collection IDs with pricing");
  }
}

// Get products by tags with pricing information
export async function getProductsByTagsWithPricing(request: Request, tags: string[]) {
  const { admin } = await authenticate.admin(request);

  // Build tag query - products that have ANY of the specified tags
  const tagQuery = tags.map(tag => `tag:${tag}`).join(' OR ');

  const query = `
    query GetProductsByTagsWithPricing($query: String!, $first: Int!, $cursor: String) {
      products(query: $query, first: $first, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
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
    let allProducts: any[] = [];
    let cursor: string | null = null;
    let hasNextPage = true;
    let pagesProcessed = 0;
    const maxPages = 5; // Limit to avoid timeout

    while (hasNextPage && pagesProcessed < maxPages) {
      const response = await admin.graphql(query, {
        variables: { 
          query: tagQuery,
          first: 50,
          cursor 
        }
      });

      const data: any = await response.json();
      
      if (data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
      }

      const products = data.data.products.edges.map((edge: any) => ({
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
      }));

      allProducts = allProducts.concat(products);
      
      hasNextPage = data.data.products.pageInfo.hasNextPage;
      cursor = data.data.products.pageInfo.endCursor;
      pagesProcessed++;
    }

    return allProducts;

  } catch (error) {
    console.error("Error fetching products by tags with pricing:", error);
    throw new Error("Failed to fetch products by tags with pricing");
  }
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
