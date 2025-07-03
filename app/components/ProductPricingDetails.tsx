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
  Pagination,
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
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

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

      const response = await fetch(`/api/product-pricing?${params}`);
      const data = await response.json();

      if (data.success) {
        setProducts(data.products);
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
      setCurrentPage(1); // Reset to first page when modal opens
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
    // First, create all table rows (variants) for counting
    const allTableRows: string[][] = [];
    
    products.forEach((product, index) => {
      if (product.variants && product.variants.length > 0) {
        product.variants.forEach((variant) => {
          const originalPrice = parseFloat(variant.price) || 0;
          const newPrice = calculateNewPrice(variant.price, priceType, amount);
          const difference = newPrice - originalPrice;
          const differencePercentage = originalPrice > 0 ? ((difference / originalPrice) * 100).toFixed(1) : "0";

          // Format difference: dương (+$10.00), âm (-$10.00), bằng 0 (-)
          let differenceDisplay = "-";
          if (Math.abs(difference) > 0.01) { // Tránh lỗi floating point
            const sign = difference > 0 ? "+" : "";
            differenceDisplay = `${sign}${formatCurrency(difference)} (${sign}${differencePercentage}%)`;
          }

          allTableRows.push([
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

        // Format difference
        let differenceDisplay = "-";
        if (Math.abs(difference) > 0.01) {
          const sign = difference > 0 ? "+" : "";
          differenceDisplay = `${sign}${formatCurrency(difference)} (${sign}${differencePercentage}%)`;
        }

        allTableRows.push([
          product.title,
          "Default Title",
          formatCurrency(originalPrice),
          formatCurrency(newPrice),
          differenceDisplay,
        ]);
      }
    });

    // Calculate pagination based on total variants (rows)
    const totalVariants = allTableRows.length;
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    const paginatedRows = allTableRows.slice(startIndex, endIndex);
    const totalPages = Math.ceil(totalVariants / PAGE_SIZE);

    return { 
      tableRows: paginatedRows, 
      totalPages,
      startIndex,
      endIndex,
      totalVariants
    };
  };

  const { tableRows, totalPages, startIndex, endIndex, totalVariants } = prepareTableData();

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
                    {`${totalVariants} variant${totalVariants !== 1 ? 's' : ''} affected`}
                  </Badge>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="headingMd" as="h3">
                    Product Details
                  </Text>
                  <Text variant="bodyMd" tone="subdued" as="p">
                    Showing {startIndex + 1}-{Math.min(endIndex, totalVariants)} of {totalVariants} variants
                  </Text>
                </div>
                
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
                />

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '16px' }}>
                    <Pagination
                      hasPrevious={currentPage > 1}
                      onPrevious={() => setCurrentPage(currentPage - 1)}
                      hasNext={currentPage < totalPages}
                      onNext={() => setCurrentPage(currentPage + 1)}
                      label={`Page ${currentPage} of ${totalPages}`}
                    />
                  </div>
                )}
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
