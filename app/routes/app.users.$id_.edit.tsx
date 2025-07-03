import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { useState, useEffect } from "react";
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
  RadioButton,
  Toast,
  Frame,
  SkeletonPage,
  SkeletonBodyText,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getUser, updateUser, type User } from "../services/api.client";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  
  if (!params.id) {
    throw new Response("User ID is required", { status: 400 });
  }
  
  const userId = parseInt(params.id);
  
  return json({ userId });
};

export default function EditUser() {
  const { userId } = useLoaderData<typeof loader>();
  
  const navigate = useNavigate();
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastError, setToastError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<User | null>(null);

  const showToast = (message: string, isError = false) => {
    setToastMessage(message);
    setToastError(isError);
    setToastActive(true);
  };

  // Load user data
  useEffect(() => {
    const loadUser = async () => {
      try {
        setIsLoading(true);
        const user = await getUser(userId);
        setUserData(user);
      } catch (error) {
        console.error("Failed to load user:", error);
        showToast("Failed to load user data", true);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadUser();
  }, [userId]);

  const toastMarkup = toastActive ? (
    <Toast
      content={toastMessage}
      error={toastError}
      onDismiss={() => setToastActive(false)}
    />
  ) : null;

  if (isLoading) {
    return (
      <Frame>
        <SkeletonPage primaryAction>
          <Layout>
            <Layout.Section>
              <Card>
                <SkeletonBodyText />
              </Card>
            </Layout.Section>
          </Layout>
        </SkeletonPage>
      </Frame>
    );
  }

  if (!userData) {
    return (
      <Frame>
        {toastMarkup}
        <Page title="User not found">
          <Layout>
            <Layout.Section>
              <Card>
                <Text variant="bodyMd" as="p">
                  User not found or failed to load user data.
                </Text>
              </Card>
            </Layout.Section>
          </Layout>
        </Page>
      </Frame>
    );
  }

  return (
    <Frame>
      {toastMarkup}
      <EditUserForm userData={userData} userId={userId} navigate={navigate} showToast={showToast} />
    </Frame>
  );
}

function EditUserForm({ 
  userData, 
  userId, 
  navigate, 
  showToast 
}: { 
  userData: User; 
  userId: number; 
  navigate: (path: string) => void;
  showToast: (message: string, isError?: boolean) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Shopify React Form - now userData is guaranteed to exist
  const {
    fields,
    submit,
    submitting,
    dirty,
  } = useForm({
    fields: {
      name: useField({
        value: userData.name,
        validates: [
          (value) => {
            if (!value || value.trim().length < 2) {
              return "Name must be at least 2 characters";
            }
          },
        ],
      }),
      email: useField({
        value: userData.email,
        validates: [
          (value) => {
            if (!value) {
              return "Email is required";
            }
            if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value)) {
              return "Invalid email address";
            }
          },
        ],
      }),
      age: useField({
        value: userData.age,
        validates: [
          (value) => {
            const age = Number(value);
            if (!age || age < 18 || age > 65) {
              return "Age must be between 18 and 65";
            }
          },
        ],
      }),
      gender: useField({
        value: userData.gender as "male" | "female",
        validates: [
          (value) => {
            if (!value || !["male", "female"].includes(value)) {
              return "Gender is required";
            }
          },
        ],
      }),
      team: useField({
        value: userData.team,
        validates: [
          (value) => {
            if (!value) {
              return "Team is required";
            }
          },
        ],
      }),
    },
    async onSubmit(formData) {
      try {
        setIsSubmitting(true);
        await updateUser(userId, {
          name: formData.name,
          email: formData.email,
          age: Number(formData.age),
          gender: formData.gender,
          team: formData.team,
        });
        showToast("User updated successfully!");
        setTimeout(() => {
          navigate("/app");
        }, 2000);
        return { status: "success" };
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Failed to update user", true);
        return { 
          status: "fail", 
          errors: [{ 
            field: [], 
            message: error instanceof Error ? error.message : "Failed to update user" 
          }] 
        };
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  const teamOptions = [
    { label: "Select a team", value: "" },
    { label: "Team A", value: "Team A" },
    { label: "Team B", value: "Team B" },
    { label: "Team C", value: "Team C" },
  ];

  return (
    <Page title="Edit member">
      <Layout>
        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              Member details
            </Text>
            <Text variant="bodyMd" as="p" tone="subdued">
              Update the information below to modify the team member details. All fields are required.
            </Text>
          </BlockStack>
        </Layout.Section>
        
        <Layout.Section>
          <Card>
            <form onSubmit={submit}>
              <FormLayout>
                <TextField
                  label="Full name"
                  placeholder="Enter full name"
                  autoComplete="name"
                  {...fields.name}
                />

                <TextField
                  label="Email"
                  type="email"
                  placeholder="Enter email address"
                  autoComplete="email"
                  {...fields.email}
                />

                <TextField
                  label="Age"
                  type="number"
                  placeholder="Enter age"
                  autoComplete="off"
                  {...fields.age}
                  value={fields.age.value.toString()}
                  onChange={(value) => fields.age.onChange(Number(value) || 0)}
                />

                <Select
                  label="Product team"
                  options={teamOptions}
                  {...fields.team}
                />

                <BlockStack gap="300">
                  <Text variant="bodyMd" as="p">
                    Gender
                  </Text>
                  <BlockStack gap="200">
                    <RadioButton
                      label="Male"
                      checked={fields.gender.value === "male"}
                      id="male"
                      name="gender"
                      onChange={() => fields.gender.onChange("male")}
                    />
                    <RadioButton
                      label="Female"
                      checked={fields.gender.value === "female"}
                      id="female"
                      name="gender"
                      onChange={() => fields.gender.onChange("female")}
                    />
                  </BlockStack>
                  {fields.gender.error && (
                    <Text variant="bodyMd" as="p" tone="critical">
                      {fields.gender.error}
                    </Text>
                  )}
                </BlockStack>

                <Button
                  variant="primary"
                  size="large"
                  submit
                  disabled={!dirty || submitting || isSubmitting}
                  loading={submitting || isSubmitting}
                  fullWidth
                >
                  {(submitting || isSubmitting) ? "Updating..." : "Save changes"}
                </Button>
              </FormLayout>
            </form>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
