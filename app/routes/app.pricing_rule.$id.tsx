import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useActionData, useSubmit } from "@remix-run/react";
import { useState, useEffect, useCallback } from "react";
import { useAppBridge, SaveBar } from "@shopify/app-bridge-react";
import { useForm, useField } from "@shopify/react-form";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Select,
  Button,
  Text,
  BlockStack,
  Toast,
  Frame,
  RadioButton,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { CollectionPicker } from "../components/CollectionPicker";
import { TagPicker } from "../components/TagPicker";
import { ProductPricingDetails } from "../components/ProductPricingDetails";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  
  const { id } = params;
  const isEdit = id && id !== "new";
  
  if (isEdit) {
    try {
      const rule = await prisma.pricingRule.findUnique({
        where: { id }
      });
      
      if (!rule) {
        throw new Response("Pricing rule not found", { status: 404 });
      }
      
      // Fetch additional details based on rule type
      let enrichedRule: any = { ...rule };
      
      // Fetch product details if the rule applies to specific products
      if (rule.applyTo === "specific-products" && (rule.productIds || (rule as any).variantIds)) {
        try {
          // Check if we have variantIds first, then fallback to productIds
          const variantIds = (rule as any).variantIds;
          const productIds = Array.isArray(rule.productIds) ? rule.productIds : 
                           (rule.productIds ? JSON.parse(rule.productIds as string) : []);
          
          if (variantIds && variantIds.length > 0) {
            // For now, we don't have a separate API for variants, so skip this case
            // TODO: Implement variant handling when needed
          } else if (productIds && productIds.length > 0) {
            // Call GraphQL function directly instead of fetch
            const { getProductsByIds } = await import("../utils/api.graphql");
            const products = await getProductsByIds(request, productIds);
            enrichedRule.productDetails = products;
          }
        } catch (error) {
          console.error("Failed to fetch product details in loader:", error);
          enrichedRule.productDetails = [];
        }
      }
      
      // Fetch collection details if the rule applies to collections
      if (rule.applyTo === "product-collections" && rule.collectionIds) {
        try {
          const collectionIds = Array.isArray(rule.collectionIds) ? rule.collectionIds : JSON.parse(rule.collectionIds as string);
          
          if (collectionIds.length > 0) {
            // Call GraphQL function directly instead of fetch
            const { getCollectionsByIds } = await import("../utils/api.graphql");
            const collections = await getCollectionsByIds(request, collectionIds);
            
            const mappedCollections = collections.map((collection: any) => ({
              id: collection.id,
              title: collection.title,
              handle: collection.handle,
              image: collection.image,
            }));
            enrichedRule.collectionDetails = mappedCollections;
          }
        } catch (error) {
          console.error("Failed to fetch collection details in loader:", error);
          enrichedRule.collectionDetails = [];
        }
      }
      
      return json({ rule: enrichedRule, isEdit: true });
    } catch (error) {
      console.error("Failed to load pricing rule:", error);
      throw new Response("Failed to load pricing rule", { status: 500 });
    }
  }
  
  return json({ rule: null, isEdit: false });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  try {
    await authenticate.admin(request);
  } catch (authError) {
    console.error("Authentication failed:", authError);
    return json(
      { errors: { general: "Authentication failed. Please refresh and try again." } },
      { status: 401 }
    );
  }
  
  const { id } = params;
  const isEdit = id && id !== "new";
  
  let formData;
  try {
    formData = await request.formData();
  } catch (formError) {
    console.error("Failed to parse form data:", formError);
    return json(
      { errors: { general: "Failed to process form data. Please try again." } },
      { status: 400 }
    );
  }
  
  const name = formData.get("name") as string;
  const status = formData.get("status") as string;
  const priority = parseInt(formData.get("priority") as string);
  const applyTo = formData.get("applyTo") as string;
  const productIds = formData.get("productIds") as string;
  const variantIds = formData.get("variantIds") as string;
  const collectionIds = formData.get("collectionIds") as string;
  const tagIds = formData.get("tagIds") as string;
  const priceType = formData.get("priceType") as string;
  const amount = parseFloat(formData.get("amount") as string);
  
  // Validation
  const errors: Record<string, string> = {};
  
    if (!name || name.trim().length < 2) {
    errors.name = "Name must be at least 2 characters";
  }
  
  if (!status) {
    errors.status = "Status is required";
  }
  
  if (!priority || isNaN(priority) || priority < 1) {
    errors.priority = "Priority must be at least 1";
  }

  if (!applyTo) {
    errors.applyTo = "Apply to selection is required";
  }

  if (!priceType) {
    errors.priceType = "Price type is required";
  }

  if (isNaN(amount) || amount < 0) {
    errors.amount = "Amount must be a valid positive number";
  }

  // Validate specific selections
  if (applyTo === "specific-products" && (!productIds || productIds === "[]") && (!variantIds || variantIds === "[]")) {
    errors.products = "Please select at least one product or variant";
  }

  if (applyTo === "product-collections" && (!collectionIds || collectionIds === "[]")) {
    errors.collections = "Please select at least one collection";
  }

  if (applyTo === "product-tags" && (!tagIds || tagIds === "[]")) {
    errors.tags = "Please select at least one tag";
  }
  
  if (Object.keys(errors).length > 0) {
    return json({ errors }, { status: 400 });
  }

  try {
    // Parse JSON arrays for IDs
    let parsedProductIds = null;
    let parsedVariantIds = null;
    let parsedCollectionIds = null;
    let parsedTagIds = null;

    if (productIds && productIds !== "[]") {
      try {
        parsedProductIds = JSON.parse(productIds);
      } catch (e) {
        console.warn("Failed to parse productIds:", productIds);
      }
    }

    if (variantIds && variantIds !== "[]") {
      try {
        parsedVariantIds = JSON.parse(variantIds);
      } catch (e) {
        console.warn("Failed to parse variantIds:", variantIds);
      }
    }

    if (collectionIds && collectionIds !== "[]") {
      try {
        parsedCollectionIds = JSON.parse(collectionIds);
      } catch (e) {
        console.warn("Failed to parse collectionIds:", collectionIds);
      }
    }

    if (tagIds && tagIds !== "[]") {
      try {
        parsedTagIds = JSON.parse(tagIds);
      } catch (e) {
        console.warn("Failed to parse tagIds:", tagIds);
      }
    }

    if (isEdit) {
      // Update existing rule
      // First get current rule to preserve existing data
      const currentRule = await prisma.pricingRule.findUnique({
        where: { id }
      });
      
      if (!currentRule) {
        return json(
          { errors: { general: "Pricing rule not found" } },
          { status: 404 }
        );
      }
      
      // Prepare update data - only update what's provided, keep existing values otherwise
      const updateData: any = {
        name: name.trim(),
        priority,
        status,
        applyTo,
        priceType,
        amount,
      };
      
      // Handle JSON fields - keep existing if new data is empty
      if (applyTo === "specific-products") {
        updateData.productIds = parsedProductIds || currentRule.productIds;
        (updateData as any).variantIds = parsedVariantIds || (currentRule as any).variantIds;
        updateData.collectionIds = null;
        updateData.tagIds = null;
      } else if (applyTo === "product-collections") {
        updateData.collectionIds = parsedCollectionIds || currentRule.collectionIds;
        updateData.productIds = null;
        (updateData as any).variantIds = null;
        updateData.tagIds = null;
      } else if (applyTo === "product-tags") {
        updateData.tagIds = parsedTagIds || currentRule.tagIds;
        updateData.productIds = null;
        (updateData as any).variantIds = null;
        updateData.collectionIds = null;
      } else {
        // "all-products"
        updateData.productIds = null;
        (updateData as any).variantIds = null;
        updateData.collectionIds = null;
        updateData.tagIds = null;
      }
      
      await prisma.pricingRule.update({
        where: { id },
        data: updateData,
      });
      
    } else {
      // Create new rule
      const ruleId = `pr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await prisma.pricingRule.create({
        data: {
          id: ruleId,
          name: name.trim(),
          priority,
          status,
          applyTo,
          productIds: parsedProductIds,
          variantIds: parsedVariantIds,
          collectionIds: parsedCollectionIds,
          tagIds: parsedTagIds,
          priceType,
          amount,
        } as any, // Cast to any to handle new variantIds field
      });
    }

    // Return success message instead of immediate redirect
    return json({ 
      success: true, 
      message: isEdit ? "Pricing rule updated successfully!" : "Pricing rule created successfully!" 
    });
  } catch (error) {
    console.error(`Error ${isEdit ? 'updating' : 'creating'} rule:`, error);
    return json(
      { errors: { general: `Failed to ${isEdit ? 'update' : 'create'} pricing rule. Please try again.` } },
      { status: 400 }
    );
  }
};

export default function PricingRuleForm() {
  const { rule, isEdit } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const actionData = useActionData<typeof action>();
  const remixSubmit = useSubmit();
  const [toastActive, setToastActive] = useState(false);
  const [successToastActive, setSuccessToastActive] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<any[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [showPricingDetails, setShowPricingDetails] = useState(false);

  // Initialize App Bridge and SaveBar ID early
  const app = useAppBridge();
  const saveBarId = "pricing-rule-save-bar";

  // State to track original values for unsaved changes detection
  const [originalState, setOriginalState] = useState({
    name: "",
    priority: "1",
    status: "active",
    applyTo: "all-products",
    priceType: "apply-price",
    amount: "0",
    selectedProducts: [] as any[],
    selectedCollections: [] as any[],
    selectedTags: [] as string[],
  });

  // Initialize form with useForm hook
  const {
    fields: {
      name,
      priority,
      status,
      applyTo,
      priceType,
      amount,
    },
    submit,
    submitting,
    dirty,
    // reset,
  } = useForm({
    fields: {
      name: useField({
        value: rule?.name || "",
        validates: (value) => {
          if (!value || value.trim().length < 2) {
            return "Name must be at least 2 characters";
          }
        },
      }),
      priority: useField({
        value: rule?.priority?.toString() || "1",
        validates: (value) => {
          const num = parseInt(value);
          if (!value || isNaN(num) || num < 1) {
            return "Priority must be at least 1";
          }
        },
      }),
      status: useField({
        value: rule?.status || "active",
        validates: (value) => {
          if (!value) {
            return "Status is required";
          }
        },
      }),
      applyTo: useField({
        value: rule?.applyTo || "all-products",
        validates: (value) => {
          if (!value) {
            return "Apply to selection is required";
          }
        },
      }),
      priceType: useField({
        value: rule?.priceType || "apply-price",
        validates: (value) => {
          if (!value) {
            return "Price type is required";
          }
        },
      }),
      amount: useField({
        value: rule?.amount?.toString() || "0",
        validates: (value) => {
          const num = parseFloat(value);
          if (isNaN(num) || num < 0) {
            return "Amount must be a valid positive number";
          }
        },
      }),
    },
    onSubmit: async (fieldValues) => {
      // Validate selections based on applyTo
      if (fieldValues.applyTo === "specific-products" && selectedProducts.length === 0) {
        return { status: "fail", errors: [{ field: ["products"], message: "Please select at least one product" }] };
      }

      if (fieldValues.applyTo === "product-collections" && selectedCollections.length === 0) {
        return { status: "fail", errors: [{ field: ["collections"], message: "Please select at least one collection" }] };
      }

      if (fieldValues.applyTo === "product-tags" && selectedTags.length === 0) {
        return { status: "fail", errors: [{ field: ["tags"], message: "Please select at least one tag" }] };
      }

      // Create form data for submission
      const formData = new FormData();
      
      // Add basic fields
      formData.append("name", fieldValues.name);
      formData.append("priority", fieldValues.priority);
      formData.append("status", fieldValues.status);
      formData.append("applyTo", fieldValues.applyTo);
      formData.append("priceType", fieldValues.priceType);
      formData.append("amount", fieldValues.amount);
      
      // Add selection fields
      formData.append("productIds", JSON.stringify(selectedProducts.map(p => p.id)));
      
      // For simple product selection, don't use variantIds
      formData.append("variantIds", JSON.stringify([]));
      formData.append("collectionIds", JSON.stringify(selectedCollections.map(c => c.id)));
      formData.append("tagIds", JSON.stringify(selectedTags));

      try {
        // Submit using Remix's useSubmit hook
        remixSubmit(formData, {
          method: "post",
          replace: false,
        });

        // Return success to prevent form from handling the response
        // The action will handle the redirect and toast
        return { status: "success" };
      } catch (error) {
        console.error("Form submission error:", error);
        setToastActive(true); // Show error toast
        return { 
          status: "fail", 
          errors: [{ field: ["general"], message: "Failed to submit form. Please try again." }] 
        };
      }
    },
  });
  
  // Handle actionData from Remix action
  useEffect(() => {
    if (actionData) {
      if ('success' in actionData && actionData.success) {
        // Update original state to current values to clear unsaved changes
        setOriginalState({
          name: name.value,
          priority: priority.value,
          status: status.value,
          applyTo: applyTo.value,
          priceType: priceType.value,
          amount: amount.value,
          selectedProducts: [...selectedProducts],
          selectedCollections: [...selectedCollections],
          selectedTags: [...selectedTags],
        });
        
        // Hide SaveBar since changes are now saved
        app.saveBar.hide(saveBarId);
        
        setSuccessToastActive(true);
        setTimeout(() => {
          navigate("/app/pricing_rule");
        }, 2000);
      } else if ('errors' in actionData && actionData.errors) {
        setToastActive(true);
      }
    }
  }, [actionData, navigate, name.value, priority.value, status.value, applyTo.value, priceType.value, amount.value, selectedProducts, selectedCollections, selectedTags, app.saveBar, saveBarId]);

  // Set original state when data is loaded (only once, not on every selection change)
  useEffect(() => {
    if (rule && isEdit) {
      // Load initial selections from rule data
      const initialProducts = rule.productDetails || [];
      const initialCollections = rule.collectionDetails || [];
      const initialTags = Array.isArray(rule.tagIds) ? rule.tagIds : 
                         (rule.tagIds ? JSON.parse(rule.tagIds as string) : []);
      
      // Set selections first
      setSelectedProducts(initialProducts);
      setSelectedCollections(initialCollections);
      setSelectedTags(initialTags);
      
      // Then set original state
      const newOriginalState = {
        name: rule.name || "",
        priority: rule.priority?.toString() || "1",
        status: rule.status || "active",
        applyTo: rule.applyTo || "all-products",
        priceType: rule.priceType || "apply-price",
        amount: rule.amount?.toString() || "0",
        selectedProducts: initialProducts,
        selectedCollections: initialCollections,
        selectedTags: initialTags,
      };
      
      setOriginalState(newOriginalState);
    } else if (!isEdit) {
      // For new rules, set empty state
      setOriginalState({
        name: "",
        priority: "1",
        status: "active",
        applyTo: "all-products",
        priceType: "apply-price",
        amount: "0",
        selectedProducts: [],
        selectedCollections: [],
        selectedTags: [],
      });
    }
  }, [rule, isEdit]); // Remove selectedProducts/Collections/Tags from dependencies

  // Helper function to check if there are unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    // Check form fields changes
    const formChanged = dirty;
    
    // Check product/collection/tag selection changes
    const productIdsChanged = JSON.stringify(selectedProducts.map(p => p.id).sort()) !== 
                             JSON.stringify(originalState.selectedProducts.map(p => p.id).sort());
    const collectionIdsChanged = JSON.stringify(selectedCollections.map(c => c.id).sort()) !== 
                                JSON.stringify(originalState.selectedCollections.map(c => c.id).sort());
    const tagsChanged = JSON.stringify(selectedTags.sort()) !== 
                       JSON.stringify(originalState.selectedTags.sort());
    
    return formChanged || productIdsChanged || collectionIdsChanged || tagsChanged;
  }, [dirty, selectedProducts, selectedCollections, selectedTags, originalState]);

  // Show SaveBar always when form is opened
  useEffect(() => {
    app.saveBar.show(saveBarId);
    
    return () => {
      app.saveBar.hide(saveBarId);
    };
  }, [app.saveBar, saveBarId]);

  // Helper function to safely get error - not needed with react-form
  // const getError = (field: string) => { ... }

  // Helper function to check if there's a general error - not needed with react-form
  // const hasGeneralError = () => { ... }

  // Get label and prefix based on selected price type
  const getPriceInputConfig = () => {
    switch (priceType.value) {
      case "apply-price":
        return { label: "Price", prefix: "$" };
      case "decrease-fixed":
        return { label: "Amount", prefix: "$" };
      case "decrease-percentage":
        return { label: "Percentage", prefix: "%" };
      default:
        return { label: "Amount", prefix: "$" };
    }
  };

  const priceInputConfig = getPriceInputConfig();

  const handleSave = () => {
    submit();
  };

  const handleDiscard = () => {
    // Reset form to original values
    name.onChange(originalState.name);
    priority.onChange(originalState.priority);
    status.onChange(originalState.status);
    applyTo.onChange(originalState.applyTo);
    priceType.onChange(originalState.priceType);
    amount.onChange(originalState.amount);
    
    // Reset selections
    setSelectedProducts(originalState.selectedProducts);
    setSelectedCollections(originalState.selectedCollections);
    setSelectedTags(originalState.selectedTags);
    
    // Hide save bar
    app.saveBar.hide(saveBarId);
  };

  const handleNavigation = (path: string) => {
    if (hasUnsavedChanges()) {
      // Show discard confirmation - App Bridge will handle this
      app.saveBar.show(saveBarId);
      return false; // Prevent navigation
    } else {
      navigate(path);
      return true;
    }
  };
  
  // Handle form submission
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit();
  };

  // Auto-submit when App Bridge or form tells us to save
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).submitPricingRuleForm = () => {
        submit();
      };
      
      const formElement = document.getElementById('pricing-rule-form');
      if (formElement) {
        (formElement as any).submitForm = () => {
          submit();
        };
      }
      
      return () => {
        delete (window as any).submitPricingRuleForm;
      };
    }
  }, [submit]);

  // Handle keyboard shortcut for save and App Bridge events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        submit();
      }
    };

    const handleAppBridgeSave = (event: any) => {
      submit();
    };

    const handleSaveBarSubmit = () => {
      submit();
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('shopify:app:save', handleAppBridgeSave);
      window.addEventListener('shopify:section:save', handleAppBridgeSave);
      window.addEventListener('savebar:save', handleSaveBarSubmit);
      document.addEventListener('savebar:save', handleSaveBarSubmit);
      
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('shopify:app:save', handleAppBridgeSave);
        window.removeEventListener('shopify:section:save', handleAppBridgeSave);
        window.removeEventListener('savebar:save', handleSaveBarSubmit);
        document.removeEventListener('savebar:save', handleSaveBarSubmit);
      };
    }
  }, [submit]);

  const openResourcePicker = async () => {
    try {
      const currentSelectionIds = selectedProducts.map(p => p.id);
      
      const selection = await app.resourcePicker({
        type: 'product',
        multiple: true,
        selectionIds: currentSelectionIds,
      });

      if (selection) {
        const selectedProductsData = selection.map((product: any) => {
          const imageUrl = product.images && product.images.length > 0 
            ? product.images[0].originalSrc 
            : null;
          
          return {
            id: product.id,
            title: product.title,
            handle: product.handle,
            featuredImage: imageUrl ? { url: imageUrl } : null,
          };
        });
        
        setSelectedProducts(selectedProductsData);
      }
    } catch (error) {
      console.error("ResourcePicker error:", error);
    }
  };

  const handleAllProductsChange = () => {
    applyTo.onChange("all-products");
    // Clear all selections when switching to "all products"
    setSelectedProducts([]);
    setSelectedCollections([]);
    setSelectedTags([]);
  };

  const handleSpecificProductsChange = () => {
    applyTo.onChange("specific-products");
    // Clear other selections when switching to "specific products"
    setSelectedCollections([]);
    setSelectedTags([]);
    
    // If editing and the original rule had products, restore them
    if (isEdit && rule && rule.applyTo === "specific-products" && originalState.selectedProducts.length > 0) {
      setSelectedProducts(originalState.selectedProducts);
    } else {
      // For new rules or when original wasn't specific-products, start fresh
      setSelectedProducts([]);
      // Don't automatically open ResourcePicker - let user click Browse button
    }
  };

  const handleProductCollectionsChange = () => {
    applyTo.onChange("product-collections");
    // Clear other selections when switching to "collections"
    setSelectedProducts([]);
    setSelectedTags([]);
    
    // If editing and the original rule had collections, restore them
    if (isEdit && rule && rule.applyTo === "product-collections" && originalState.selectedCollections.length > 0) {
      setSelectedCollections(originalState.selectedCollections);
    } else {
      setSelectedCollections([]);
    }
  };

  const handleProductTagsChange = () => {
    applyTo.onChange("product-tags");
    // Clear other selections when switching to "tags"
    setSelectedProducts([]);
    setSelectedCollections([]);
    
    // If editing and the original rule had tags, restore them
    if (isEdit && rule && rule.applyTo === "product-tags" && originalState.selectedTags.length > 0) {
      setSelectedTags(originalState.selectedTags);
    } else {
      setSelectedTags([]);
    }
  };

  const removeProduct = (productId: string) => {
    setSelectedProducts(selectedProducts.filter(p => p.id !== productId));
  };

  // Filter products based on search
  const filteredProducts = selectedProducts.filter(product =>
    product.title.toLowerCase().includes(searchValue.toLowerCase())
  );


  const statusOptions = [
    { label: "Enable", value: "active" },
    { label: "Disable", value: "inactive" },
    { label: "Draft", value: "draft" },
  ];

  const pageTitle = isEdit ? `Edit ${rule?.name || 'Pricing Rule'}` : "Create rule";

  const toastMarkup = toastActive ? (
    <Toast
      content="An error occurred while saving. Please try again."
      error
      onDismiss={() => setToastActive(false)}
    />
  ) : null;

  const successToastMarkup = successToastActive ? (
    <Toast
      content={isEdit ? "Pricing rule updated successfully!" : "Pricing rule created successfully!"}
      onDismiss={() => setSuccessToastActive(false)}
    />
  ) : null;

  return (
    <Frame>
      {toastMarkup}
      {successToastMarkup}
      <Page
        title={pageTitle}
        backAction={{
          content: "Back to pricing rules",
          onAction: () => handleNavigation("/app/pricing_rule"),
        }}
      >
        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="plain"
                  onClick={() => setShowPricingDetails(true)}
                  accessibilityLabel="Show product pricing details"
                >
                  👁 Show product pricing details
                </Button>
              </div>
              
              <Card>
                <div style={{ padding: '20px' }}>
                  <BlockStack gap="100">
                    <Text variant="headingMd" as="h2">
                      General information
                    </Text
                    >
                    
                    <form 
                        id="pricing-rule-form"
                        data-save-bar={dirty ? true : undefined}
                        onSubmit={handleFormSubmit}
                    >
                      {submitting && (
                        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div>Saving...</div>
                        </div>
                      )}
                      <FormLayout>
                        <TextField
                          label="Name"
                          name="name"
                          autoComplete="off"
                          value={name.value}
                          onChange={name.onChange}
                          error={name.error}
                        />

                        <TextField
                          label="Priority"
                          name="priority"
                          type="number"
                          autoComplete="off"
                          value={priority.value}
                          onChange={priority.onChange}
                          error={priority.error}
                        />

                        <Select
                          label="Status"
                          name="status"
                          options={statusOptions}
                          value={status.value}
                          onChange={status.onChange}
                          error={status.error}
                        />
                      </FormLayout>
                    </form>
                  </BlockStack>
                </div>
              </Card>

              <Card>
                <div style={{ padding: '20px' }}>
                  <BlockStack gap="400">
                    <Text variant="headingMd" as="h2">
                      Apply to products
                    </Text>
                    
                    <BlockStack gap="200">
                      <RadioButton
                        label="All products"
                        id="all-products"
                        name="apply-to"
                        checked={applyTo.value === "all-products"}
                        onChange={handleAllProductsChange}
                      />
                      <RadioButton
                        label="Specific products"
                        id="specific-products"
                        name="apply-to"
                        checked={applyTo.value === "specific-products"}
                        onChange={handleSpecificProductsChange}
                      />
                      <RadioButton
                        label="Product collections"
                        id="product-collections"
                        name="apply-to"
                        checked={applyTo.value === "product-collections"}
                        onChange={handleProductCollectionsChange}
                      />
                      <RadioButton
                        label="Product tags"
                        id="product-tags"
                        name="apply-to"
                        checked={applyTo.value === "product-tags"}
                        onChange={handleProductTagsChange}
                      />
                    </BlockStack>

                    {applyTo.value === "specific-products" && (
                      <div style={{ marginTop: '16px' }}>
                        {selectedProducts.length > 0 ? (
                          <BlockStack gap="200">
                            <Text variant="bodyMd" as="p">
                              Selected products ({selectedProducts.length})
                            </Text>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                              <div style={{ flex: 1 }}>
                                <TextField
                                  label=""
                                  placeholder="Search product"
                                  value={searchValue}
                                  onChange={(value) => setSearchValue(value)}
                                  autoComplete="off"
                                />
                              </div>
                              <Button
                                variant="plain"
                                onClick={openResourcePicker}
                                size="slim"
                              >
                                Edit selection
                              </Button>
                            </div>
                            {filteredProducts.map((product) => (
                              <div key={product.id}>
                                <div
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
                                  <div style={{ 
                                    width: '32px', 
                                    height: '32px', 
                                    borderRadius: '4px',
                                    flexShrink: 0,
                                    backgroundColor: '#e1e3e5',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}>
                                    {(product.featuredImage?.url || product.featuredImage) ? (
                                      <img
                                        src={product.featuredImage?.url || product.featuredImage}
                                        alt={product.featuredImage?.altText || product.title}
                                        style={{ 
                                          width: '100%', 
                                          height: '100%', 
                                          objectFit: 'cover', 
                                          borderRadius: '4px'
                                        }}
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                        }}
                                      />
                                    ) : (
                                      <div style={{
                                        width: '16px',
                                        height: '16px',
                                        backgroundColor: '#8c9196',
                                        borderRadius: '2px'
                                      }} />
                                    )}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <Text variant="bodyMd" fontWeight="medium" as="p" truncate>
                                      {product.title}
                                    </Text>
                                  </div>
                                  <Button
                                    variant="plain"
                                    tone="critical"
                                    onClick={() => removeProduct(product.id)}
                                    accessibilityLabel={`Remove ${product.title}`}
                                    size="micro"
                                  >
                                    ✕
                                  </Button>
                                </div>
                              </div>
                            ))}
                            
                            {filteredProducts.length === 0 && searchValue && (
                              <div style={{ 
                                padding: '16px', 
                                textAlign: 'center', 
                                backgroundColor: '#f9fafb',
                                border: '1px solid #e1e3e5',
                                borderRadius: '8px'
                              }}>
                                <Text variant="bodyMd" tone="subdued" as="p">
                                  No products found matching "{searchValue}"
                                </Text>
                              </div>
                            )}
                          </BlockStack>
                        ) : (
                          <div style={{ 
                            padding: '20px', 
                            textAlign: 'center', 
                            backgroundColor: '#f9fafb',
                            border: '1px solid #e1e3e5',
                            borderRadius: '8px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                              <Text variant="bodyMd" tone="subdued" as="span">
                                No products selected.
                              </Text>
                              <Button
                                variant="plain"
                                onClick={openResourcePicker}
                                size="slim"
                              >
                                Browse
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {applyTo.value === "product-collections" && (
                      <CollectionPicker
                        selectedCollections={selectedCollections}
                        onCollectionsChange={setSelectedCollections}
                      />
                    )}

                    {applyTo.value === "product-tags" && (
                      <TagPicker
                        selectedTags={selectedTags}
                        onTagsChange={setSelectedTags}
                      />
                    )}
                  </BlockStack>
                </div>
              </Card>

              <Card>
                <div style={{ padding: '20px' }}>
                  <BlockStack gap="400">
                    <Text variant="headingMd" as="h2">
                      Custom prices
                    </Text>
                    
                    <BlockStack gap="200">
                      <RadioButton
                        label="Apply a price to selected products"
                        id="apply-price"
                        name="price-type"
                        checked={priceType.value === "apply-price"}
                        onChange={() => priceType.onChange("apply-price")}
                      />
                      <RadioButton
                        label="Decrease a fixed amount of the original prices of selected products"
                        id="decrease-fixed"
                        name="price-type"
                        checked={priceType.value === "decrease-fixed"}
                        onChange={() => priceType.onChange("decrease-fixed")}
                      />
                      <RadioButton
                        label="Decrease the original prices of selected products by a percentage (%)"
                        id="decrease-percentage"
                        name="price-type"
                        checked={priceType.value === "decrease-percentage"}
                        onChange={() => priceType.onChange("decrease-percentage")}
                      />
                    </BlockStack>

                    <TextField
                      label={priceInputConfig.label}
                      name="amount"
                      type="number"
                      autoComplete="off"
                      value={amount.value}
                      onChange={amount.onChange}
                      prefix={priceInputConfig.prefix}
                      error={amount.error}
                    />
                  </BlockStack>
                </div>
              </Card>
            
              {/* Hidden submit button for form */}
              <div style={{ display: 'none' }}>
                <Button
                  submit
                >
                  Submit
                </Button>
              </div>
            </BlockStack>
          </Layout.Section>
        </Layout>

        {/* Product Pricing Details Modal */}
        <ProductPricingDetails
          open={showPricingDetails}
          onClose={() => setShowPricingDetails(false)}
          applyTo={applyTo.value as "all-products" | "specific-products" | "product-collections" | "product-tags"}
          selectedProductIds={selectedProducts.map(p => p.id)}
          selectedCollectionIds={selectedCollections.map(c => c.id)}
          selectedTags={selectedTags}
          priceType={priceType.value as "apply-price" | "decrease-fixed" | "decrease-percentage"}
          amount={amount.value}
        />
      </Page>

      {/* Save Bar */}
      <SaveBar id={saveBarId}>
        <button 
          onClick={handleSave}
          disabled={!hasUnsavedChanges()}
          style={{ 
            backgroundColor: hasUnsavedChanges() ? '#008060' : '#b3b3b3', 
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 16px',
            cursor: hasUnsavedChanges() ? 'pointer' : 'not-allowed'
          }}
        >
          Save
        </button>
        <button 
          onClick={handleDiscard}
          style={{ 
            backgroundColor: 'transparent', 
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            padding: '8px 16px',
            cursor: 'pointer'
          }}
        >
          Discard
        </button>
      </SaveBar>
    </Frame>
  );
}
