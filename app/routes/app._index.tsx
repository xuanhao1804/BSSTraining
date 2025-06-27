import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
// import { Link } from "@remix-run/react";

import { useState, useEffect, useCallback } from "react";
import {
  Page,Link,
  Layout,
  Card,
  IndexTable,
  Badge,
  Text,
  useIndexResourceState,
  Toast,
  Frame,
  Popover,
  ActionList,
  Button,
} from "@shopify/polaris";

import {
  MenuVerticalIcon,
  DuplicateIcon,
  DeleteIcon,
} from "@shopify/polaris-icons";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  getUsers,
  deleteUsers as apiDeleteUsers,
  duplicateUsers as apiDuplicateUsers,
  type User,
} from "../utils/api.client";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

export const links = () => [
  { rel: "stylesheet", href: polarisStyles },
];


export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // Just return empty for initial load, we'll use client-side API calls
  return json({
    users: [],
    pagination: {
      page: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
      total: 0,
    },
  });
};

export default function Index() {
  const [users, setUsers] = useState<(User & { [key: string]: unknown })[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastError, setToastError] = useState(false);
  const [bulkActionPopoverActive, setBulkActionPopoverActive] = useState(false);

  const resourceName = {
    singular: "member",
    plural: "members",
  };

  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
    clearSelection,
  } = useIndexResourceState(users.map((u) => ({ ...u, id: u.id.toString() })));

  // Load users data
  const loadUsers = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const data = await getUsers(page, 5);
      setUsers(data.users.map((user) => ({ ...user })));
      setPagination(data.pagination);
    } catch (error) {
      showToast("Failed to load users", true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const showToast = (message: string, isError = false) => {
    setToastMessage(message);
    setToastError(isError);
    setToastActive(true);
  };

  const handleBulkAction = async (actionType: string) => {
    if (selectedResources.length === 0) {
      showToast("No users selected", true);
      return;
    }

    try {
      const ids = selectedResources.map((id) => parseInt(id));

      if (actionType === "duplicate") {
        await apiDuplicateUsers(ids);
        showToast(
          `${selectedResources.length} user(s) duplicated successfully`,
        );
      } else if (actionType === "delete") {
        await apiDeleteUsers(ids);
        showToast(`${selectedResources.length} user(s) deleted successfully`);
      }

      clearSelection();
      setBulkActionPopoverActive(false);
      await loadUsers(pagination.page); // Reload current page
    } catch (error) {
      showToast(`Failed to ${actionType} users`, true);
    }
  };

  const handlePageChange = (direction: "next" | "previous") => {
    const newPage =
      direction === "next" ? pagination.page + 1 : pagination.page - 1;
    loadUsers(newPage);
  };

  // Bulk actions menu (displayed when items are selected)
  const bulkActionsMarkup =
    selectedResources.length > 0 ? (
<div
  style={{
    position: "absolute",
    top: "12px",
    right: "16px",
    zIndex: 1000,
    
  }}
>
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
          content: "Duplicate users",
          icon: DuplicateIcon,
          onAction: () => handleBulkAction("duplicate"),
        },
        {
          content: "Delete users",
          icon: DeleteIcon,
          destructive: true,
          onAction: () => handleBulkAction("delete"),
        },
      ]}
    />
  </Popover>
</div>

    ) : null;

const rowMarkup = users.map((user: User, index: number) => (
  <IndexTable.Row
    id={user.id.toString()}
    key={user.id}
    selected={selectedResources.includes(user.id.toString())}
    position={index}
  >
    <IndexTable.Cell>
      <Text variant="bodyMd" fontWeight="bold" as="span">
        {user.id}
      </Text>
    </IndexTable.Cell>
<IndexTable.Cell>
  <div
    onClick={(e) => {
      e.stopPropagation();
    }}
  >
    <Link
      url={`/app/users/${user.id}/edit`}
    >
      <Text fontWeight="bold" as="span">{user.name}</Text>
    </Link>
  </div>
</IndexTable.Cell>


    <IndexTable.Cell>
      <Text variant="bodyMd" as="span">
        {user.email}
      </Text>
    </IndexTable.Cell>
    <IndexTable.Cell>
      <Text variant="bodyMd" as="span">
        {user.age}
      </Text>
    </IndexTable.Cell>
    <IndexTable.Cell>
      <Badge tone={user.gender === "male" ? "info" : "critical"}>
        {user.gender}
      </Badge>
    </IndexTable.Cell>
    <IndexTable.Cell>
      <Badge
        tone={
          user.team === "Team A"
            ? "success"
            : user.team === "Team B"
            ? "warning"
            : user.team === "Team C"
            ? "attention"
            : "info"
        }
      >
        {user.team}
      </Badge>
    </IndexTable.Cell>
  </IndexTable.Row>
));


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
      <Page
        title="BSS Members"
        primaryAction={{
          content: "Add new member",
          url: "/app/users/new",
        }}
      >
        <TitleBar title="User Management" />
        <Layout>
          <Layout.Section>
            <Card>
              {" "}
              {bulkActionsMarkup}
              <div style={{ position: "relative" }}>
                <IndexTable
                  resourceName={resourceName}
                  itemCount={users.length}
                  selectedItemsCount={
                    allResourcesSelected ? "All" : selectedResources.length
                  }
                  onSelectionChange={handleSelectionChange}
                  loading={loading}
                  headings={[
                    { title: "ID" },
                    { title: "Name" },
                    { title: "Email" },
                    { title: "Age" },
                    { title: "Gender" },
                    { title: "Product team" },
                  ]}
                  pagination={{
                    hasPrevious: pagination.hasPrevious,
                    hasNext: pagination.hasNext,
                    onNext: () => handlePageChange("next"),
                    onPrevious: () => handlePageChange("previous"),
                  }}
                >
                  {rowMarkup}
                </IndexTable>
              </div>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
}
