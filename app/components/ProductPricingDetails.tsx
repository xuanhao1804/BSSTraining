import { useState, useEffect, useCallback } from "react";
import {
  Modal,
  Text,
  BlockStack,
  DataTable,
  Badge,
  EmptyState,
  Card,
  Divider,
  Spinner,
} from "@shopify/polaris";

interface Product {
  id: string;
  title: string;
  handle: string;
  featuredImage?: {
    url: string;
    altText?: string;
  };
  variants?: ProductVariant[];
}

interface ProductVariant {
  id: string;
  title: string;
  price: string;
  compareAtPrice?: string;
  sku?: string;
}

interface ProductPricingDetailsProps {
  open: boolean;
  onClose: () => void;
  applyTo: "all-products" | "specific-products" | "product-collections" | "product-tags";
  selectedProductIds?: string[];
  selectedCollectionIds?: string[];
  selectedTags?: string[];
  priceType: "apply-price" | "decrease-fixed" | "decrease-percentage";
  amount: string;
}

export function ProductPricingDetails({
  open,
  onClose,
  applyTo,
  selectedProductIds = [],
  selectedCollectionIds = [],
  selectedTags = [],
  priceType,
  amount,
}: ProductPricingDetailsProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProductsWithPricing = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        applyTo,
      });

      // Add relevant IDs/tags based on applyTo type
      if (applyTo === "specific-products" && selectedProductIds.length > 0) {
        params.append("productIds", selectedProductIds.join(","));
      } else if (applyTo === "product-collections" && selectedCollectionIds.length > 0) {
        params.append("collectionIds", selectedCollectionIds.join(","));
      } else if (applyTo === "product-tags" && selectedTags.length > 0) {
        params.append("tags", selectedTags.join(","));
      }

      console.log("Fetching products with params:", { applyTo, selectedProductIds, selectedCollectionIds, selectedTags });
      console.log("API URL:", `/api/product-pricing?${params}`);

      const response = await fetch(`/api/product-pricing?${params}`);
      const data = await response.json();

      console.log("API response:", data);

      if (data.success) {
        console.log("Setting products:", data.products);
        console.log("First product structure:", data.products[0]);
        setProducts(data.products);
        console.log("Products set:", data.products.length);
      } else {
        setError(data.error || "Failed to fetch products");
      }
    } catch (err) {
      console.error("Error fetching products with pricing:", err);
      setError("Failed to fetch products with pricing");
    } finally {
      setLoading(false);
    }
  }, [applyTo, selectedProductIds, selectedCollectionIds, selectedTags]);

  // Fetch products when modal opens
  useEffect(() => {
    if (open) {
      fetchProductsWithPricing();
    }
  }, [open, fetchProductsWithPricing]);
  // Calculate new price based on price type
  const calculateNewPrice = (originalPrice: string, type: string, value: string): number => {
    const original = parseFloat(originalPrice) || 0;
    const amountValue = parseFloat(value) || 0;

    switch (type) {
      case "apply-price":
        return amountValue;
      case "decrease-fixed":
        return Math.max(0, original - amountValue);
      case "decrease-percentage":
        return Math.max(0, original - (original * amountValue / 100));
      default:
        return original;
    }
  };

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Get price type description
  const getPriceTypeDescription = () => {
    switch (priceType) {
      case "apply-price":
        return `Apply fixed price: ${formatCurrency(parseFloat(amount) || 0)}`;
      case "decrease-fixed":
        return `Decrease by fixed amount: ${formatCurrency(parseFloat(amount) || 0)}`;
      case "decrease-percentage":
        return `Decrease by percentage: ${amount}%`;
      default:
        return "No pricing rule applied";
    }
  };

  // Prepare table data inside render to ensure state is updated
  const prepareTableData = () => {
    const tableRows: string[][] = [];
    let totalOriginal = 0;
    let totalModified = 0;

    console.log("Preparing table rows for products:", products.length);
    console.log("Products data:", products);
    console.log("Price calculation params:", { priceType, amount });

    products.forEach((product, index) => {
      console.log(`Processing product ${index}:`, product);
      if (product.variants && product.variants.length > 0) {
        product.variants.forEach((variant) => {
          const originalPrice = parseFloat(variant.price) || 0;
          const newPrice = calculateNewPrice(variant.price, priceType, amount);
          console.log(`Price calculation for ${product.title} - ${variant.title}:`, {
            originalPrice: variant.price,
            priceType,
            amount,
            calculatedNewPrice: newPrice
          });
          const difference = newPrice - originalPrice; // Modified - Original (có thể âm hoặc dương)
          const differencePercentage = originalPrice > 0 ? ((difference / originalPrice) * 100).toFixed(1) : "0";

          totalOriginal += originalPrice;
          totalModified += newPrice;

          // Format difference: dương (+$10.00), âm (-$10.00), bằng 0 (-)
          let differenceDisplay = "-";
          if (Math.abs(difference) > 0.01) { // Tránh lỗi floating point
            const sign = difference > 0 ? "+" : "";
            differenceDisplay = `${sign}${formatCurrency(difference)} (${sign}${differencePercentage}%)`;
          }

          tableRows.push([
            product.title,
            variant.title || "Default Title",
            formatCurrency(originalPrice),
            formatCurrency(newPrice),
            differenceDisplay,
          ]);
        });
      } else {
        // Fallback for products without variants (using mock price)
        const originalPrice = 100; // Mock price for demo
        const newPrice = calculateNewPrice(originalPrice.toString(), priceType, amount);
        const difference = newPrice - originalPrice;
        const differencePercentage = originalPrice > 0 ? ((difference / originalPrice) * 100).toFixed(1) : "0";

        totalOriginal += originalPrice;
        totalModified += newPrice;

        // Format difference
        let differenceDisplay = "-";
        if (Math.abs(difference) > 0.01) {
          const sign = difference > 0 ? "+" : "";
          differenceDisplay = `${sign}${formatCurrency(difference)} (${sign}${differencePercentage}%)`;
        }

        tableRows.push([
          product.title,
          "Default Title",
          formatCurrency(originalPrice),
          formatCurrency(newPrice),
          differenceDisplay,
        ]);
      }
    });

    const totalDifference = totalModified - totalOriginal; // Modified - Original
    const totalDifferencePercentage = totalOriginal > 0 ? ((totalDifference / totalOriginal) * 100).toFixed(1) : "0";

    return { tableRows, totalOriginal, totalModified, totalDifference, totalDifferencePercentage };
  };

  const { tableRows, totalOriginal, totalModified, totalDifference, totalDifferencePercentage } = prepareTableData();

  const tableHeaders = [
    "Product",
    "Variant", 
    "Original Price",
    "Modified Price",
    "Difference",
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Product pricing details"
      size="large"
      primaryAction={{
        content: "Close",
        onAction: onClose,
      }}
    >
      <Modal.Section>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <Spinner accessibilityLabel="Loading products" size="large" />
          </div>
        ) : error ? (
          <EmptyState
            heading="Error loading products"
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>{error}</p>
          </EmptyState>
        ) : (
          <BlockStack gap="400">
          {/* Pricing Rule Summary */}
          <Card>
            <div style={{ padding: '16px' }}>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h3">
                  Pricing Rule Summary
                </Text>
                <Text variant="bodyMd" as="p">
                  {getPriceTypeDescription()}
                </Text>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <Badge tone="info">
                    {`${products.length} product${products.length !== 1 ? 's' : ''} affected`}
                  </Badge>
                  {Math.abs(totalDifference) > 0.01 && (
                    <Badge tone={totalDifference > 0 ? "attention" : "success"}>
                      {`Total difference: ${totalDifference > 0 ? '+' : ''}${formatCurrency(totalDifference)} (${totalDifference > 0 ? '+' : ''}${totalDifferencePercentage}%)`}
                    </Badge>
                  )}
                </div>
              </BlockStack>
            </div>
          </Card>

          <Divider />

          {/* Product Details Table */}
          {(() => {
            return products.length > 0;
          })() ? (
            <div>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h3">
                  Product Details
                </Text>
                
                <DataTable
                  columnContentTypes={[
                    'text',    // Product
                    'text',    // Variant
                    'numeric', // Original Price
                    'numeric', // Modified Price
                    'text',    // Difference
                  ]}
                  headings={tableHeaders}
                  rows={tableRows}
                  footerContent={
                    tableRows.length > 1 ? (
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        padding: '12px 16px',
                        fontWeight: 'bold',
                        borderTop: '1px solid #e1e3e5'
                      }}>
                        <span>Total ({tableRows.length} items)</span>
                        <div style={{ display: 'flex', gap: '40px' }}>
                          <span>{formatCurrency(totalOriginal)}</span>
                          <span>{formatCurrency(totalModified)}</span>
                          <span>
                            {Math.abs(totalDifference) > 0.01 
                              ? `${totalDifference > 0 ? '+' : ''}${formatCurrency(totalDifference)} (${totalDifference > 0 ? '+' : ''}${totalDifferencePercentage}%)`
                              : '-'
                            }
                          </span>
                        </div>
                      </div>
                    ) : undefined
                  }
                />
              </BlockStack>
            </div>
          ) : (
            <EmptyState
              heading="No products selected"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Select products to see pricing details and calculations.</p>
            </EmptyState>
          )}
          </BlockStack>
        )}
      </Modal.Section>
    </Modal>
  );
}
