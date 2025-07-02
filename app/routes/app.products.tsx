import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { Page, Button, Card, ResourceList, Text, BlockStack, EmptyState, Badge, InlineStack } from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({});
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const body = await request.json();
  
  if (body.action === "fetchTags") {
    const query = `
      query getProductTags($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product {
            id
            title
            tags
          }
        }
      }
    `;

    try {
      console.log("Fetching tags for product IDs:", body.productIds);
      
      const response = await admin.graphql(query, {
        variables: { ids: body.productIds }
      });
      
      const result = await response.json();
      const resultData = result as any;
      console.log("Raw GraphQL result:", JSON.stringify(resultData, null, 2));
      
      if (resultData.errors) {
        console.error("GraphQL errors:", resultData.errors);
        return json({ 
          products: [], 
          success: false, 
          error: "GraphQL errors: " + JSON.stringify(resultData.errors)
        });
      }
      
      const nodes = resultData.data?.nodes || [];
      console.log("Extracted nodes:", nodes);
      
      return json({ 
        products: nodes,
        success: true 
      });
    } catch (error) {
      console.error("GraphQL error:", error);
      return json({ 
        products: [], 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
  
  return json({ success: false, error: "Invalid action" });
};

interface SelectedProduct {
  id: string;
  title: string;
  handle: string;
  tags?: string[];
  featuredImage?: {
    url: string;
    altText?: string;
  };
}

export default function ProductList() {
  const app = useAppBridge();
  const [products, setProducts] = useState<SelectedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Function để fetch tags từ GraphQL
  const fetchProductTags = async (productIds: string[]) => {
    try {
      console.log("Sending product IDs to fetch tags:", productIds);
      
      // Gọi qua action route để authenticate với Shopify
      const response = await fetch("/app/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "fetchTags",
          productIds: productIds
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("Full tags response:", JSON.stringify(result, null, 2));
      console.log("Products from response:", result.products);
      
      return result.products || [];
    } catch (error) {
      console.error("Fetch tags error:", error);
      return [];
    }
  };

  const openResourcePicker = async () => {
    setIsLoading(true);
    
    try {
      // Sử dụng App Bridge ResourcePicker API mới
      const selection = await app.resourcePicker({
        type: 'product',
        multiple: true,
        selectionIds: products.map(p => ({ id: p.id })),
      });

      if (selection) {
        const selectedProducts = selection.map((product: any) => ({
          id: product.id,
          title: product.title,
          handle: product.handle,
          featuredImage: product.featuredImage,
        }));
        
        // Fetch tags cho các products đã chọn
        const productIds = selectedProducts.map(p => p.id);
        const tagsData = await fetchProductTags(productIds);
        console.log("tagsData:", tagsData);

        // Combine tags với product data
        const productsWithTags = selectedProducts.map(product => {
          const tagInfo = tagsData.find((t: any) => t.id === product.id);
          return {
            ...product,
            tags: tagInfo?.tags || []
          };
        });
        
        setProducts(productsWithTags);
        console.log("Selected products with tags:", productsWithTags);
      }
    } catch (error) {
      console.error("ResourcePicker error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearSelection = () => {
    setProducts([]);
  };

  return (
    <Page title="Product Selection with ResourcePicker">
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">
            Select Products from your Store
          </Text>
          
          <Button 
            variant="primary" 
            onClick={openResourcePicker}
            loading={isLoading}
          >
            Choose Products
          </Button>

          {products.length > 0 ? (
            <BlockStack gap="300">
              <Text variant="headingSm" as="h3">
                Selected Products ({products.length})
              </Text>
              
              <ResourceList
                resourceName={{ singular: 'product', plural: 'products' }}
                items={products}
                renderItem={(item) => {
                  const { id, title, handle, tags, featuredImage } = item;
                  return (
                    <ResourceList.Item 
                      id={id} 
                      accessibilityLabel={`View details for ${title}`}
                      onClick={() => console.log('Product clicked:', id)}
                      media={featuredImage ? (
                        <img 
                          src={featuredImage.url} 
                          alt={featuredImage.altText || title}
                          style={{ width: 50, height: 50, objectFit: 'cover' }}
                        />
                      ) : undefined}
                    >
                      <BlockStack gap="100">
                        <Text variant="bodyMd" fontWeight="bold" as="h4">
                          {title}
                        </Text>
                        <Text variant="bodySm" tone="subdued" as="p">
                          Handle: {handle}
                        </Text>
                        
                        {/* Hiển thị tags nếu có */}
                        {tags && tags.length > 0 && (
                          <InlineStack gap="100">
                            {tags.map((tag, index) => (
                              <Badge key={index} tone="info">
                                {tag}
                              </Badge>
                            ))}
                          </InlineStack>
                        )}
                        
                        <Text variant="bodySm" tone="subdued" as="p">
                          ID: {id}
                        </Text>
                      </BlockStack>
                    </ResourceList.Item>
                  );
                }}
              />
              
              <Button onClick={clearSelection} tone="critical">
                Clear Selection
              </Button>
            </BlockStack>
          ) : (
            <EmptyState
              heading="No products selected"
              action={{
                content: 'Choose Products',
                onAction: openResourcePicker,
              }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Select products from your store using the ResourcePicker.</p>
            </EmptyState>
          )}
        </BlockStack>
      </Card>
    </Page>
  );
}
