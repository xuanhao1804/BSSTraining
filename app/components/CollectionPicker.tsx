import { useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import {
  Button,
  Text,
  BlockStack,
  TextField,
} from "@shopify/polaris";

interface Collection {
  id: string;
  title: string;
  handle: string;
  image?: {
    url: string;
    altText?: string;
  } | null;
}

interface CollectionPickerProps {
  selectedCollections: Collection[];
  onCollectionsChange: (collections: Collection[]) => void;
}

export function CollectionPicker({ selectedCollections, onCollectionsChange }: CollectionPickerProps) {
  const [searchValue, setSearchValue] = useState("");
  const app = useAppBridge();

  const openResourcePicker = async () => {
    try {
      const selection = await app.resourcePicker({
        type: 'collection',
        multiple: true,
        selectionIds: selectedCollections.map(c => ({ id: c.id })),
      });

      if (selection) {
        const selectedCollectionsData = selection.map((collection: any) => {
          console.log("Collection data from ResourcePicker:", collection);
          console.log("Collection image structure:", collection.image);
          
          // Collection có thể có ảnh ở nhiều field khác nhau
          const imageUrl = collection.image?.url || 
                          collection.image?.originalSrc ||
                          collection.featuredImage?.url ||
                          collection.featuredImage?.originalSrc ||
                          null;
          
          return {
            id: collection.id,
            title: collection.title,
            handle: collection.handle,
            image: imageUrl ? { url: imageUrl, altText: collection.image?.altText } : null,
          };
        });
        
        onCollectionsChange(selectedCollectionsData);
        console.log("Selected collections:", selectedCollectionsData);
      }
    } catch (error) {
      console.error("Collection ResourcePicker error:", error);
    }
  };

  const removeCollection = (collectionId: string) => {
    onCollectionsChange(selectedCollections.filter(c => c.id !== collectionId));
  };

  // Filter collections based on search
  const filteredCollections = selectedCollections.filter(collection =>
    collection.title.toLowerCase().includes(searchValue.toLowerCase())
  );

  return (
    <div style={{ marginTop: '16px' }}>
      {selectedCollections.length > 0 ? (
        <BlockStack gap="200">
          <Text variant="bodyMd" as="p">Selected collections ({selectedCollections.length})</Text>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <TextField
                label=""
                placeholder="Search collection"
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
          
          {filteredCollections.map((collection) => (
            <div
              key={collection.id}
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
                {collection.image?.url ? (
                  <img
                    src={collection.image.url}
                    alt={collection.image.altText || collection.title}
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      objectFit: 'cover', 
                      borderRadius: '4px'
                    }}
                    onError={(e) => {
                      console.log("Image load error for collection:", collection.title, "URL:", collection.image?.url);
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
                  {collection.title}
                </Text>
              </div>
              <Button
                variant="plain"
                tone="critical"
                onClick={() => removeCollection(collection.id)}
                accessibilityLabel={`Remove ${collection.title}`}
                size="micro"
              >
                ✕
              </Button>
            </div>
          ))}
          
          {filteredCollections.length === 0 && searchValue && (
            <div style={{ 
              padding: '16px', 
              textAlign: 'center', 
              backgroundColor: '#f9fafb',
              border: '1px solid #e1e3e5',
              borderRadius: '8px'
            }}>
              <Text variant="bodyMd" tone="subdued" as="p">
                No collections found matching "{searchValue}"
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
              No collections selected.
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
  );
}

export default CollectionPicker;
