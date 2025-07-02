import { useCallback, useState } from "react";
import { Button, TextField, BlockStack, Modal, Text, EmptyState, Checkbox } from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";

interface Product {
  id: string;
  title: string;
  handle: string;
  featuredImage?: {
    url: string;
    altText?: string;
  };
  variants?: Variant[];
}

interface Variant {
  id: string;
  title: string;
  price: string;
  sku?: string;
}

interface ProductPickerProps {
  selectedProducts: Product[];
  onProductsChange: (products: Product[]) => void;
  open: boolean;
  onClose: () => void;
  allowVariants?: boolean; // New prop to enable variant selection
}

export function ProductPicker({ selectedProducts, onProductsChange, open, onClose, allowVariants = false }: ProductPickerProps) {
  const app = useAppBridge();
  const [isLoading, setIsLoading] = useState(false);

  const openResourcePicker = async () => {
    setIsLoading(true);
    
    try {
      // Use variant picker if allowVariants is true, otherwise use product picker
      const selection = await app.resourcePicker({
        type: allowVariants ? 'variant' : 'product',
        multiple: true,
        selectionIds: allowVariants 
          ? selectedProducts.flatMap(p => p.variants?.map(v => ({ id: v.id })) || [])
          : selectedProducts.map(p => ({ id: p.id })),
      });

      if (selection) {
        if (allowVariants) {
          // For variant selection, group variants by product
          const variantMap = new Map<string, any>();
          
          selection.forEach((variant: any) => {
            const productId = variant.product.id;
            if (!variantMap.has(productId)) {
              variantMap.set(productId, {
                id: productId,
                title: variant.product.title,
                handle: variant.product.handle,
                featuredImage: variant.product.featuredImage,
                variants: []
              });
            }
            
            variantMap.get(productId)!.variants.push({
              id: variant.id,
              title: variant.title,
              price: variant.price,
              sku: variant.sku,
            });
          });
          
          const selectedProductsData = Array.from(variantMap.values());
          onProductsChange(selectedProductsData);
          console.log("Selected variants grouped by products:", selectedProductsData);
        } else {
          // For product selection (existing logic)
          const selectedProductsData = selection.map((product: any) => ({
            id: product.id,
            title: product.title,
            handle: product.handle,
            featuredImage: product.featuredImage,
          }));
          
          onProductsChange(selectedProductsData);
          console.log("Selected products:", selectedProductsData);
        }
      }
      
      // Close modal after selection
      onClose();
    } catch (error) {
      console.error("ResourcePicker error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <Modal
      open={open}
      onClose={handleCancel}
      title={allowVariants ? "Select product variants from your store" : "Select products from your store"}
      primaryAction={{
        content: allowVariants ? 'Select Variants' : 'Select Products',
        onAction: openResourcePicker,
        loading: isLoading,
      }}
      secondaryActions={[
        {
          content: 'Cancel',
          onAction: handleCancel,
        },
      ]}
      size="small"
    >
      <Modal.Section>
        <EmptyState
          heading={allowVariants ? "Choose product variants from your store" : "Choose products from your store"}
          action={{
            content: allowVariants ? 'Open Variant Picker' : 'Open Product Picker',
            onAction: openResourcePicker,
            loading: isLoading,
          }}
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>{allowVariants 
            ? "Select specific product variants from your Shopify store using the resource picker."
            : "Select products from your Shopify store using the resource picker."
          }</p>
        </EmptyState>
      </Modal.Section>
    </Modal>
  );
}

interface ProductSelectionProps {
  selectedProducts: Product[];
  onProductsChange: (products: Product[]) => void;
}

export function ProductSelection({ selectedProducts, onProductsChange }: ProductSelectionProps) {
  const app = useAppBridge();
  const [isLoading, setIsLoading] = useState(false);

  const openResourcePicker = async () => {
    setIsLoading(true);
    
    try {
      // Sử dụng App Bridge ResourcePicker API trực tiếp
      const selection = await app.resourcePicker({
        type: 'product',
        multiple: true,
        selectionIds: selectedProducts.map(p => ({ id: p.id })),
      });

      if (selection) {
        const selectedProductsData = selection.map((product: any) => ({
          id: product.id,
          title: product.title,
          handle: product.handle,
          featuredImage: product.featuredImage,
        }));
        
        onProductsChange(selectedProductsData);
        console.log("Selected products:", selectedProductsData);
      }
    } catch (error) {
      console.error("ResourcePicker error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const removeProduct = useCallback((productId: string) => {
    onProductsChange(selectedProducts.filter(p => p.id !== productId));
  }, [selectedProducts, onProductsChange]);

  return (
    <BlockStack gap="300">
      <TextField
        label=""
        placeholder="Search products"
        value=""
        onChange={() => {}}
        autoComplete="off"
        connectedRight={
          <Button onClick={openResourcePicker} loading={isLoading}>
            Browse
          </Button>
        }
      />
      
      {selectedProducts.length > 0 && (
        <BlockStack gap="200">
          {selectedProducts.map((product) => (
            <div
              key={product.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 16px',
                backgroundColor: '#f9fafb',
                border: '1px solid #e1e3e5',
                borderRadius: '8px',
                gap: '12px'
              }}
            >
              <Checkbox
                label=""
                checked={true}
                onChange={() => removeProduct(product.id)}
              />
              {product.featuredImage?.url && (
                <img
                  src={product.featuredImage.url}
                  alt={product.featuredImage.altText || product.title}
                  style={{ 
                    width: '32px', 
                    height: '32px', 
                    objectFit: 'cover', 
                    borderRadius: '4px',
                    flexShrink: 0
                  }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text variant="bodyMd" fontWeight="medium" as="p" truncate>
                  {product.title}
                </Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <Button
                  variant="plain"
                  tone="critical"
                  onClick={() => removeProduct(product.id)}
                  accessibilityLabel={`Remove ${product.title}`}
                  size="micro"
                >
                  ✕
                </Button>
                <Button
                  variant="plain"
                  tone="success"
                  onClick={openResourcePicker}
                  loading={isLoading}
                  size="micro"
                >
                  Edit
                </Button>
              </div>
            </div>
          ))}
        </BlockStack>
      )}
    </BlockStack>
  );
}