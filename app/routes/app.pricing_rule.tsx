import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher, Outlet, useLocation } from "@remix-run/react";
import { useState, useEffect } from "react";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Badge,
  Text,
  EmptyState,
  Button,
  ButtonGroup,
  useIndexResourceState,
  Modal,
  Toast,
  Frame,
  Popover,
  ActionList,
} from "@shopify/polaris";
import {
  EditIcon,
  DuplicateIcon,
  DeleteIcon,
  MenuVerticalIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

interface PricingRule {
  id: string;
  name: string;
  status: string;
  priority: number;
  applyTo: string;
  priceType: string;
  amount: number;
  createdAt: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Get shop from authenticated session instead of params
    const { session } = await authenticate.admin(request);
    
    if (!session.shop) {
      return json({ pricingRules: [], totalCount: 0, currentPage: 1, totalPages: 1 });
    }

    // Find shop in database
    const dbShop = await prisma.shop.findUnique({ 
      where: { shop: session.shop } 
    });
    
    if (!dbShop) {
      console.error("Shop not found in database:", session.shop);
      return json({ pricingRules: [], totalCount: 0, currentPage: 1, totalPages: 1 });
    }

    // Get pagination parameters
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;

    // Get total count
    const totalCount = await prisma.pricingRule.count();

    // Use Prisma client for pricing rules (they are stored in our database)
    const pricingRules = await prisma.pricingRule.findMany({
      skip: offset,
      take: limit,
      orderBy: [
        { createdAt: 'desc' }
      ]
    });

    return json({ 
      pricingRules, 
      totalCount, 
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit)
    });
  } catch (error) {
    console.error("Failed to load pricing rules:", error);
    return json({ 
      pricingRules: [], 
      totalCount: 0, 
      currentPage: 1, 
      totalPages: 1 
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    // Get shop from authenticated session instead of params
    const { session } = await authenticate.admin(request);
    
    if (!session.shop) {
      return json(
        { success: false, message: "No shop in session" },
        { status: 400 }
      );
    }

    // Find shop in database
    const dbShop = await prisma.shop.findUnique({ 
      where: { shop: session.shop } 
    });
    
    if (!dbShop) {
      return json(
        { success: false, message: "Shop not authorized" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const actionType = formData.get("actionType") as string;
    const ruleId = formData.get("ruleId") as string;
    const ruleIds = formData.get("ruleIds") as string; // For bulk actions

    switch (actionType) {
      case "bulkDelete":
        if (!ruleIds) {
          return json(
            { success: false, message: "No rules selected" },
            { status: 400 }
          );
        }
        
        const idsToDelete = JSON.parse(ruleIds);
        await prisma.pricingRule.deleteMany({
          where: { id: { in: idsToDelete } }
        });
        
        return json({ 
          success: true, 
          message: `${idsToDelete.length} pricing rule(s) deleted successfully!` 
        });

      case "bulkDuplicate":
        if (!ruleIds) {
          return json(
            { success: false, message: "No rules selected" },
            { status: 400 }
          );
        }
        
        const idsToDuplicate = JSON.parse(ruleIds);
        const rulesToDuplicate = await prisma.pricingRule.findMany({
          where: { id: { in: idsToDuplicate } }
        });
        
        const duplicatedRules = rulesToDuplicate.map(rule => ({
          id: `pr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: `${rule.name} (Copy)`,
          priority: rule.priority,
          status: "inactive",
          applyTo: rule.applyTo,
          productIds: rule.productIds as any,
          collectionIds: rule.collectionIds as any,
          tagIds: rule.tagIds as any,
          priceType: rule.priceType,
          amount: rule.amount,
        }));
        
        await prisma.pricingRule.createMany({
          data: duplicatedRules
        });
        
        return json({ 
          success: true, 
          message: `${idsToDuplicate.length} pricing rule(s) duplicated successfully!` 
        });

      case "delete":
        await prisma.pricingRule.delete({
          where: { id: ruleId }
        });
        return json({ 
          success: true, 
          message: "Pricing rule deleted successfully!" 
        });

      case "duplicate":
        // Get the original rule
        const originalRule = await prisma.pricingRule.findUnique({
          where: { id: ruleId }
        });

        if (!originalRule) {
          return json(
            { success: false, message: "Original rule not found" },
            { status: 404 }
          );
        }

        // Create a new rule with duplicated data
        const newRuleId = `pr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await prisma.pricingRule.create({
          data: {
            id: newRuleId,
            name: `${originalRule.name} (Copy)`,
            priority: originalRule.priority,
            status: "inactive", // Set duplicated rules to inactive by default
            applyTo: originalRule.applyTo,
            productIds: originalRule.productIds as any,
            collectionIds: originalRule.collectionIds as any,
            tagIds: originalRule.tagIds as any,
            priceType: originalRule.priceType,
            amount: originalRule.amount,
          },
        });

        return json({ 
          success: true, 
          message: "Pricing rule duplicated successfully!" 
        });

      default:
        return json(
          { success: false, message: "Invalid action type" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Action error:", error);
    return json(
      { success: false, message: "Operation failed. Please try again." },
      { status: 500 }
    );
  }
};

export default function PricingRules() {
  const { pricingRules, currentPage, totalPages } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const location = useLocation();
  
  // Check if we're on the main list page (not a child route)
  const isMainRoute = location.pathname === "/app/pricing_rule" || location.pathname === "/app/pricing_rule/";
  
  const [deleteModalActive, setDeleteModalActive] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<string | null>(null);
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastError, setToastError] = useState(false);
  const [bulkActionPopoverActive, setBulkActionPopoverActive] = useState(false);

  // Track loading states
  const isLoading = fetcher.state === "submitting" || fetcher.state === "loading";
  const isDeleting = isLoading && fetcher.formData?.get("actionType") === "delete";

  const resourceName = {
    singular: "pricing rule",
    plural: "pricing rules",
  };

  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
    clearSelection,
  } = useIndexResourceState(pricingRules as any[] || []);

  // Pagination handlers
  const handlePageChange = (page: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set('page', page.toString());
    navigate(url.pathname + url.search);
  };

  const showToast = (message: string, isError = false) => {
    setToastMessage(message);
    setToastError(isError);
    setToastActive(true);
  };

  const handleBulkAction = async (actionType: string) => {
    if (selectedResources.length === 0) {
      showToast("No rules selected", true);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("actionType", actionType === "duplicate" ? "bulkDuplicate" : "bulkDelete");
      formData.append("ruleIds", JSON.stringify(selectedResources));
      
      fetcher.submit(formData, { method: "post" });
      
      clearSelection();
      setBulkActionPopoverActive(false);
    } catch (error) {
      showToast(`Failed to ${actionType} rules`, true);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return <Badge tone="success">Enable</Badge>;
      case "inactive":
        return <Badge tone="critical">Disable</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleEdit = (ruleId: string) => {
    navigate(`/app/pricing_rule/${ruleId}`);
  };

  const handleDuplicate = async (ruleId: string) => {
    const formData = new FormData();
    formData.append("actionType", "duplicate");
    formData.append("ruleId", ruleId);
    
    fetcher.submit(formData, { method: "post" });
  };

  const handleDelete = (ruleId: string) => {
    setRuleToDelete(ruleId);
    setDeleteModalActive(true);
  };

  const confirmDelete = async () => {
    if (!ruleToDelete) return;

    const formData = new FormData();
    formData.append("actionType", "delete");
    formData.append("ruleId", ruleToDelete);
    
    fetcher.submit(formData, { method: "post" });
    
    setDeleteModalActive(false);
    setRuleToDelete(null);
  };

  // Handle fetcher response
  useEffect(() => {
    if (fetcher.data && typeof fetcher.data === 'object' && 'success' in fetcher.data) {
      const responseData = fetcher.data as any;
      if (responseData.success) {
        setToastMessage(responseData.message);
        setToastError(false);
        setToastActive(true);
      } else {
        setToastMessage(responseData.message);
        setToastError(true);
        setToastActive(true);
      }
    }
  }, [fetcher.data]);

  // Bulk actions menu (displayed when items are selected)
  const bulkActionsMarkup = selectedResources.length > 0 ? (
    <div style={{
      position: "absolute",
      top: "12px",
      right: "16px",
      zIndex: 1000,
    }}>
      <Popover
        active={bulkActionPopoverActive}
        activator={
          <Button
            icon={MenuVerticalIcon}
            onClick={() => setBulkActionPopoverActive(!bulkActionPopoverActive)}
            accessibilityLabel="More actions"
            variant="tertiary"
            size="slim"
          />
        }
        onClose={() => setBulkActionPopoverActive(false)}
      >
        <ActionList
          items={[
            {
              content: "Duplicate rules",
              icon: DuplicateIcon,
              onAction: () => handleBulkAction("duplicate"),
            },
            {
              content: "Delete rules",
              icon: DeleteIcon,
              destructive: true,
              onAction: () => handleBulkAction("delete"),
            },
          ]}
        />
      </Popover>
    </div>
  ) : null;

  const rowMarkup = (pricingRules as any[] || []).map((rule: PricingRule, index: number) => {
    const actionRuleId = fetcher.formData?.get("ruleId") as string;
    const isCurrentRuleLoading = isLoading && actionRuleId === rule.id;
    const isCurrentRuleDeleting = isCurrentRuleLoading && fetcher.formData?.get("actionType") === "delete";
    const isCurrentRuleDuplicating = isCurrentRuleLoading && fetcher.formData?.get("actionType") === "duplicate";
    
    // Calculate row number based on current page
    const rowNumber = (currentPage - 1) * 10 + index + 1;
    
    return (
      <IndexTable.Row 
        id={rule.id} 
        key={rule.id} 
        position={index}
        selected={selectedResources.includes(rule.id)}
        tone={isCurrentRuleDeleting ? "critical" : undefined}
      >
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span">
            {rowNumber}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Text variant="bodyMd" fontWeight="bold" as="span">
              {rule.name}
            </Text>
            {isCurrentRuleDuplicating && (
              <div style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '4px',
                fontSize: '12px',
                color: '#6366f1'
              }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  border: '2px solid #6366f1',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Duplicating...
              </div>
            )}
            {isCurrentRuleDeleting && (
              <div style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '4px',
                fontSize: '12px',
                color: '#dc2626'
              }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  border: '2px solid #dc2626',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Deleting...
              </div>
            )}
          </div>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {getStatusBadge(rule.status)}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span">
            {rule.priority}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <ButtonGroup>
            <Button
              icon={EditIcon}
              onClick={() => handleEdit(rule.id)}
              accessibilityLabel={`Edit ${rule.name}`}
              size="slim"
              variant="tertiary"
              disabled={isCurrentRuleLoading}
            />
            <Button
              icon={DeleteIcon}
              onClick={() => handleDelete(rule.id)}
              accessibilityLabel={`Delete ${rule.name}`}
              size="slim"
              variant="tertiary"
              tone="critical"
              disabled={isCurrentRuleLoading}
              loading={isCurrentRuleDeleting}
            />
            <Button
              icon={DuplicateIcon}
              onClick={() => handleDuplicate(rule.id)}
              accessibilityLabel={`Duplicate ${rule.name}`}
              size="slim"
              variant="tertiary"
              disabled={isCurrentRuleLoading}
              loading={isCurrentRuleDuplicating}
            />
          </ButtonGroup>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  const getRuleToDeleteName = () => {
    const rule = (pricingRules as any[] || []).find((r: any) => r?.id === ruleToDelete);
    return rule ? rule.name : "";
  };

  const toastMarkup = toastActive ? (
    <Toast
      content={toastMessage}
      error={toastError}
      onDismiss={() => setToastActive(false)}
    />
  ) : null;

  return (
    <Frame>
      {toastMarkup}
      
      {/* Add CSS animation for spinner */}
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      
      {/* Render main list page only when on main route */}
      {isMainRoute && (
        <Page
          title="🛍️ Pricing rules"
          primaryAction={{
            content: "Create new rule",
            onAction: () => navigate("/app/pricing_rule/new"),
          }}
        >
          <Layout>
            <Layout.Section>
              <Card>
                {bulkActionsMarkup}
                <div style={{ position: "relative" }}>
                  {pricingRules.length > 0 ? (
                  <IndexTable
                    resourceName={resourceName}
                    itemCount={pricingRules.length}
                    selectedItemsCount={
                      allResourcesSelected ? "All" : selectedResources.length
                    }
                    onSelectionChange={handleSelectionChange}
                    headings={[
                      { title: "No" },
                      { title: "Name" },
                      { title: "Status" },
                      { title: "Priority" },
                      { title: "Actions" },
                    ]}
                    selectable={true}
                    pagination={{
                      hasPrevious: currentPage > 1,
                      hasNext: currentPage < totalPages,
                      onNext: () => handlePageChange(currentPage + 1),
                      onPrevious: () => handlePageChange(currentPage - 1),
                    }}
                  >
                    {rowMarkup}
                  </IndexTable>
                ) : (
                  <EmptyState
                    heading="No pricing rules yet"
                    action={{
                      content: "Create new rule",
                      onAction: () => navigate("/app/pricing_rule/new"),
                    }}
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >                      <p>Create your first pricing rule to get started.</p>
                    </EmptyState>
                  )}
                </div>
              </Card>
            </Layout.Section>
          </Layout>

          {/* Delete Confirmation Modal */}
          <Modal
            open={deleteModalActive}
            onClose={() => setDeleteModalActive(false)}
            title="Delete pricing rule"
            primaryAction={{
              content: "Delete",
              destructive: true,
              onAction: confirmDelete,
              loading: isDeleting,
            }}
            secondaryActions={[
              {
                content: "Cancel",
                onAction: () => setDeleteModalActive(false),
                disabled: isDeleting,
              },
            ]}
          >
            <Modal.Section>
              <Text as="p">
                Are you sure you want to delete "{getRuleToDeleteName()}"? This action cannot be undone.
              </Text>
            </Modal.Section>
          </Modal>
        </Page>
      )}

      {/* Outlet for child routes (/new, /:id) */}
      <Outlet />

    </Frame>
  );
}
