import { useState, useCallback, useEffect } from "react";
import {
  Text,
  BlockStack,
  Tag,
  LegacyStack,
  Autocomplete,
} from "@shopify/polaris";

interface TagPickerProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
}

export function TagPicker({ selectedTags, onTagsChange }: TagPickerProps) {
  const [inputValue, setInputValue] = useState("");
  const [allTags, setAllTags] = useState<{ value: string; label: string }[]>([]);
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [forceRenderKey, setForceRenderKey] = useState(0); // Add this to force re-render

  const updateOptions = useCallback((tags: { value: string; label: string }[], searchTerm: string) => {
    if (searchTerm === '') {
      setOptions(tags);
      return;
    }

    // When searching, prioritize tags that start with search term
    const searchLower = searchTerm.toLowerCase();

    const startsWithTags = tags.filter((tag) =>
      tag.label.toLowerCase().startsWith(searchLower)
    );
    
    const containsTags = tags.filter((tag) =>
      tag.label.toLowerCase().includes(searchLower) && 
      !tag.label.toLowerCase().startsWith(searchLower)
    );

    const filteredTags = [...startsWithTags, ...containsTags];

    // Add "Add new tag" option if input doesn't match any existing tag
    const hasExactMatch = tags.some((tag) => 
      tag.value.toLowerCase() === searchTerm.toLowerCase()
    );
    
    if (!hasExactMatch && searchTerm.trim() && !selectedTags.includes(searchTerm.trim())) {
      filteredTags.unshift({
        value: searchTerm.trim(),
        label: `➕ Add tag: "${searchTerm.trim()}"`
      });
    }

    setOptions(filteredTags);
  }, [selectedTags]);

  // Fetch tags from API - chỉ gọi một lần lúc đầu
  const fetchTags = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/tags`);
      const data = await response.json();
      
      if (data.success && Array.isArray(data.tags)) {
        const formattedTags = data.tags.map((tag: string) => ({ 
          value: tag, 
          label: tag 
        }));
        setAllTags(formattedTags);
        setOptions(formattedTags);
      } else {
        console.error("Error fetching tags:", data.error);
        setAllTags([]);
        setOptions([]);
      }
    } catch (error) {
      console.error("Failed to fetch tags:", error);
      setAllTags([]);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load initial tags on mount
  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const updateText = useCallback((value: string) => {
    setInputValue(value);
    
    // Chỉ filter local data, không gọi API
    updateOptions(allTags, value);
  }, [allTags, updateOptions]);

  const handleSelection = useCallback((selected: string[]) => {
    console.log("handleSelection called with:", selected);
    
    // Check if new selection contains a "Add tag" option
    const addNewTagOption = selected.find(tag => tag.startsWith('➕ Add tag: "') && tag.endsWith('"'));
    
    if (addNewTagOption) {
      console.log("Found add new tag option:", addNewTagOption);
      const actualTag = addNewTagOption.slice(13, -1); // Remove '➕ Add tag: "' and '"'
      console.log("Extracted tag:", actualTag);
      
      // Add to selectedTags
      const newSelectedTags = [...selectedTags.filter(t => !t.startsWith('➕ Add tag:')), actualTag];
      onTagsChange(newSelectedTags);
      
      // Add to allTags for future searches
      const newAllTags = [...allTags, { value: actualTag, label: actualTag }];
      setAllTags(newAllTags);
      
      // Clear input and reset options to show all tags
      console.log("Clearing input...");
      setInputValue("");
      
      // Reset options to show all available tags (when input is empty)
      updateOptions(newAllTags, "");
      
      // Force re-render to ensure input is cleared
      setForceRenderKey(prev => prev + 1);
    } else {
      // Normal tag selection - chỉ update selection, KHÔNG làm gì khác
      console.log("Normal tag selection");
      onTagsChange(selected);
      
      // Also clear input for normal selections and show all tags
      setInputValue("");
      updateOptions(allTags, "");
    }
  }, [selectedTags, onTagsChange, allTags, updateOptions]);

  const removeTag = useCallback((tag: string) => () => {
    const newSelected = selectedTags.filter(t => t !== tag);
    onTagsChange(newSelected);
  }, [selectedTags, onTagsChange]);

  // Create vertical content (selected tags)
  const verticalContentMarkup = selectedTags.length > 0 ? (
    <LegacyStack spacing="extraTight" alignment="center">
      {selectedTags.map((tag) => (
        <Tag key={`tag-${tag}`} onRemove={removeTag(tag)}>
          {tag}
        </Tag>
      ))}
    </LegacyStack>
  ) : null;

  // Clear input when selectedTags changes (as a fallback)
  useEffect(() => {
    // If a tag was just added and input still has value, clear it
    if (inputValue && selectedTags.some(tag => tag === inputValue.trim())) {
      setInputValue("");
      updateOptions(allTags, "");
    }
  }, [selectedTags, inputValue, allTags, updateOptions]);

  return (
    <div style={{ marginTop: '16px' }}>
      <BlockStack gap="200">
        <Text variant="bodyMd" as="p">
          Tags {selectedTags.length > 0 && `(${selectedTags.length} selected)`}
        </Text>

        <Autocomplete
          key={forceRenderKey} // Force re-render when key changes
          allowMultiple
          options={options}
          selected={selectedTags}
          onSelect={handleSelection}
          loading={loading}
          textField={
            <Autocomplete.TextField
              onChange={updateText}
              label=""
              value={inputValue}
              placeholder={loading ? "Loading tags..." : "Search or add tags"}
              verticalContent={verticalContentMarkup}
              autoComplete="off"
            />
          }
          emptyState={
            inputValue && !loading && options.length === 0 ? (
              <Text variant="bodyMd" tone="subdued" as="p">
                No tags found
              </Text>
            ) : undefined
          }
          listTitle="Available Tags"
        />

        {selectedTags.length === 0 && inputValue === "" && (
          <Text variant="bodyMd" tone="subdued" as="p">
            No tags selected
          </Text>
        )}
      </BlockStack>
    </div>
  );
}
