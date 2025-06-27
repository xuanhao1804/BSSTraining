import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useNavigate } from "@remix-run/react";
import { useState } from "react";
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
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { createUser } from "../utils/api.client";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({});
};

export default function NewUser() {
  const navigate = useNavigate();
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastError, setToastError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Shopify React Form
  const {
    fields,
    submit,
    submitting,
    dirty,
  } = useForm({
    fields: {
      name: useField({
        value: "",
        validates: [
          (value) => {
            if (!value || value.trim().length < 2) {
              return "Name must be at least 2 characters";
            }
          },
        ],
      }),
      email: useField({
        value: "",
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
        value: 18,
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
        value: "male" as "male" | "female",
        validates: [
          (value) => {
            if (!value || !["male", "female"].includes(value)) {
              return "Gender is required";
            }
          },
        ],
      }),
      team: useField({
        value: "",
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
        await createUser({
          name: formData.name,
          email: formData.email,
          age: Number(formData.age),
          gender: formData.gender,
          team: formData.team,
        });
        showToast("User created successfully!");
        setTimeout(() => {
          navigate("/app");
        }, 2000);
        return { status: "success" };
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Failed to create user", true);
        return { 
          status: "fail", 
          errors: [{ 
            field: [], 
            message: error instanceof Error ? error.message : "Failed to create user" 
          }] 
        };
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  const showToast = (message: string, isError = false) => {
    setToastMessage(message);
    setToastError(isError);
    setToastActive(true);
  };

  const teamOptions = [
    { label: "Select a team", value: "" },
    { label: "Team A", value: "Team A" },
    { label: "Team B", value: "Team B" },
    { label: "Team C", value: "Team C" },
  ];

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
      <Page title="Add new member">
        <Layout>
          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Member details
              </Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                Fill in the information below to add a new team member. All fields are required.
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
                    {(submitting || isSubmitting) ? "Creating..." : "Save member"}
                  </Button>
                </FormLayout>
              </form>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
}
