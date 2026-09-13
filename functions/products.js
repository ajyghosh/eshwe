"use strict";
const crypto = require("node:crypto");
const { CommerceError, stock } = require("./commerce");
const fields = new Set(["name", "slug", "sku", "category", "fabric", "color", "description", "price", "originalPrice", "discountPercent", "collectionLabel", "occasionTags", "availableStock", "status", "featured", "primaryImageUrl", "primaryImagePath", "galleryImageUrls", "galleryImagePaths", "length", "washCare", "productNote", "sareeCareTips", "dryingTips"]);
function createProductService({ db, timestamp }) {
  const keyRef = (kind, value) => db.collection("productKeys").doc(crypto.createHash("sha256").update(`${kind}:${value.toLowerCase()}`).digest("hex"));
  async function save({ id, changes, expectedVersion }, actor) {
    if (!changes || Object.keys(changes).some(key => !fields.has(key))) throw new CommerceError(400, "Invalid product fields.");
    const ref = id ? db.collection("sarees").doc(id) : db.collection("sarees").doc();
    await db.runTransaction(async tx => {
      const existing = await tx.get(ref);
      if (id && !existing.exists) throw new CommerceError(404, "Product not found.");
      const previous = existing.data() || {};
      if (id && expectedVersion !== (previous.updatedAt?.toMillis?.() ?? previous.updatedAt ?? null)) throw new CommerceError(409, "This product changed after you opened it. Reopen the product to review the latest stock before saving.");
      const product = { ...previous, ...changes };
      if (id && product.sku !== previous.sku) throw new CommerceError(400, "SKU is permanent. Create a different product for a different SKU.");
      for (const field of ["name","sku","slug","category","fabric"]) if (typeof product[field] !== "string" || !product[field].trim() || product[field].length > 200) throw new CommerceError(400, `${field} is required and must be under 200 characters.`);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug)) throw new CommerceError(400, "Use a valid product URL slug.");
      if (!Number.isFinite(product.price) || product.price <= 0 || !Number.isInteger(product.availableStock) || product.availableStock < 0) throw new CommerceError(400, "Enter a positive price and a whole stock count of zero or more.");
      if (!["active","out_of_stock","draft"].includes(product.status)) throw new CommerceError(400, "Invalid visibility.");
      const keys = [keyRef("sku",product.sku),keyRef("slug",product.slug)];
      const claims = await Promise.all(keys.map(key => tx.get(key)));
      if (claims.some(s => s.exists && s.data().productId !== ref.id)) throw new CommerceError(409, "That SKU or product URL is already used.");
      // Check legacy products that predate the identity registry as well.
      const legacy = await Promise.all(["sku","slug"].map(field => tx.get(db.collection("sarees").where(field,"==",product[field]).limit(2))));
      if (legacy.some(q => q.docs.some(s => s.id !== ref.id))) throw new CommerceError(409, "That SKU or product URL is already used.");
      keys.forEach(key => tx.set(key,{productId:ref.id}));
      if (previous.slug && previous.slug !== product.slug) tx.delete(keyRef("slug",previous.slug));
      const updates = { ...changes, updatedAt: timestamp() };
      // Stock-based availability is computed separately from publication status.
      if (changes.availableStock > 0 && previous.status === "out_of_stock" && changes.status === undefined) updates.status = "active";
      if (!id) { updates.createdAt = timestamp(); updates.reservedStock = 0; }
      tx.set(ref,updates,{merge:true});
      tx.set(ref.collection("inventoryHistory").doc(), { actor, previousStock: stock(previous.availableStock), nextStock: product.availableStock, reservedStock: stock(previous.reservedStock), action: id ? "product_updated" : "product_created", createdAt: timestamp() });
    });
    return { id: ref.id };
  }
  return { save };
}
module.exports = { createProductService };
