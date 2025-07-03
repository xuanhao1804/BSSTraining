import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server"; // giả sử prisma instance
import {
  getAllProductsWithPricing,
  getProductsByIdsWithPricing,
  getProductsByCollectionIdsWithPricing,
  getProductsByTagsWithPricing,
} from "../services/api.graphql";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const dbShop = await prisma.shop.findUnique({ where: { shop } });
  if (!dbShop) {
    return json({ success: false, error: "Shop not found in DB" }, { status: 401 });
  }

  const accessToken = dbShop.accessToken;
  const body = await request.json();
  const { applyTo, productIds, collectionIds, tags } = body;

  try {
    let products = [];

    switch (applyTo) {
      case "all-products":
        products = await getAllProductsWithPricing(shop, accessToken, 100);
        break;

      case "specific-products":
        if (productIds && Array.isArray(productIds) && productIds.length > 0) {
          products = await getProductsByIdsWithPricing(shop, accessToken, productIds);
        }
        break;

      case "product-collections":
        if (collectionIds && Array.isArray(collectionIds) && collectionIds.length > 0) {
          products = await getProductsByCollectionIdsWithPricing(shop, accessToken, collectionIds);
        }
        break;

      case "product-tags":
        if (tags && Array.isArray(tags) && tags.length > 0) {
          products = await getProductsByTagsWithPricing(shop, accessToken, tags);
        }
        break;

      default:
        return json({ 
          success: false, 
          error: "Invalid applyTo parameter" 
        }, { status: 400 });
    }

    return json({
      success: true,
      products,
      count: products.length,
      applyTo,
    });

  } catch (error) {
    console.error("❌ Error fetching products with pricing:", error);
    return json({
      success: false,
      error: "Failed to fetch products with pricing",
    }, { status: 500 });
  }
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const dbShop = await prisma.shop.findUnique({ where: { shop } });
  if (!dbShop) {
    return json({ success: false, error: "Shop not found in DB" }, { status: 401 });
  }

  const accessToken = dbShop.accessToken;
  const url = new URL(request.url);
  const applyTo = url.searchParams.get("applyTo");
  const productIds = url.searchParams.get("productIds");
  const collectionIds = url.searchParams.get("collectionIds");
  const tags = url.searchParams.get("tags");

  try {
    let products = [];

    switch (applyTo) {
      case "all-products":
        products = await getAllProductsWithPricing(shop, accessToken, 100);
        if (products.length === 0) {
          products = getMockProducts();
        }
        break;

      case "specific-products":
        if (productIds) {
          const ids = productIds.split(",").filter(id => id.trim());
          if (ids.length > 0) {
            products = await getProductsByIdsWithPricing(shop, accessToken, ids);
          }
        }
        break;

      case "product-collections":
        if (collectionIds) {
          const ids = collectionIds.split(",").filter(id => id.trim());
          if (ids.length > 0) {
            products = await getProductsByCollectionIdsWithPricing(shop, accessToken, ids);
          }
        }
        break;

      case "product-tags":
        if (tags) {
          const tagList = tags.split(",").filter(tag => tag.trim());
          if (tagList.length > 0) {
            products = await getProductsByTagsWithPricing(shop, accessToken, tagList);
          }
        }
        break;

      default:
        return json({
          success: false,
          error: "Invalid applyTo parameter. Must be one of: all-products, specific-products, product-collections, product-tags"
        }, { status: 400 });
    }

    return json({
      success: true,
      products,
      count: products.length,
      applyTo,
    });

  } catch (error) {
    console.error("❌ Error fetching products with pricing:", error);
    return json({
      success: false,
      error: "Failed to fetch products with pricing",
    }, { status: 500 });
  }
};

// Helper mock
function getMockProducts() {
  return [
    {
      id: "gid://shopify/Product/mock1",
      title: "Mock Product 1",
      handle: "mock-product-1",
      featuredImage: null,
      variants: [
        { id: "gid://shopify/ProductVariant/mock1", title: "Default Title", price: "29.99", sku: "MOCK-001" }
      ]
    },
    {
      id: "gid://shopify/Product/mock2",
      title: "Mock Product 2",
      handle: "mock-product-2",
      featuredImage: null,
      variants: [
        { id: "gid://shopify/ProductVariant/mock2", title: "Small", price: "19.99", sku: "MOCK-002-S" },
        { id: "gid://shopify/ProductVariant/mock3", title: "Large", price: "24.99", sku: "MOCK-002-L" }
      ]
    }
  ];
}
