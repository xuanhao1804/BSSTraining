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
} from "@shopify/polaris";
import {
  EditIcon,
  DuplicateIcon,
  DeleteIcon,
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
  await authenticate.admin(request);

  try {
    // Sử dụng Prisma client thay vì raw SQL
    const pricingRules = await prisma.pricingRule.findMany({
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return json({ pricingRules });
  } catch (error) {
    console.error("Failed to load pricing rules:", error);
    return json({ pricingRules: [] });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const actionType = formData.get("actionType") as string;
  const ruleId = formData.get("ruleId") as string;

  try {
    switch (actionType) {
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
            status: "draft", // Set duplicated rules to draft by default
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
  const { pricingRules } = useLoaderData<typeof loader>();
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
  } = useIndexResourceState(pricingRules);

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return <Badge tone="success">Enable</Badge>;
      case "inactive":
        return <Badge tone="critical">Disable</Badge>;
      case "draft":
        return <Badge tone="attention">Draft</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleEdit = (ruleId: string) => {
    // Navigate to edit page using Remix navigate
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
        // No need to reload page - Remix will automatically revalidate
      } else {
        setToastMessage(responseData.message);
        setToastError(true);
        setToastActive(true);
      }
    }
  }, [fetcher.data]);

  const rowMarkup = pricingRules.map((rule: PricingRule, index: number) => {
    const actionRuleId = fetcher.formData?.get("ruleId") as string;
    const isCurrentRuleLoading = isLoading && actionRuleId === rule.id;
    const isCurrentRuleDeleting = isCurrentRuleLoading && fetcher.formData?.get("actionType") === "delete";
    const isCurrentRuleDuplicating = isCurrentRuleLoading && fetcher.formData?.get("actionType") === "duplicate";
    
    return (
      <IndexTable.Row 
        id={rule.id} 
        key={rule.id} 
        position={index}
        selected={selectedResources.includes(rule.id)}
        tone={isCurrentRuleDeleting ? "critical" : undefined}
      >
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
    const rule = pricingRules.find(r => r.id === ruleToDelete);
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
                {pricingRules.length > 0 ? (
                  <IndexTable
                    resourceName={resourceName}
                    itemCount={pricingRules.length}
                    selectedItemsCount={
                      allResourcesSelected ? "All" : selectedResources.length
                    }
                    onSelectionChange={handleSelectionChange}
                    headings={[
                      { title: "Name" },
                      { title: "Status" },
                      { title: "Priority" },
                      { title: "Actions" },
                    ]}
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
                  >
                    <p>Create your first pricing rule to get started.</p>
                  </EmptyState>
                )}
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
