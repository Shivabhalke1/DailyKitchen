export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  displayOrder: number;
}

export interface ProductVariant {
  id: string;
  productId: string;
  weightLabel: '250g' | '500g' | '1kg' | '1 piece' | '1 bunch';
  weightGrams: number;
  price: number; // in INR ₹
  mrp: number; // in INR ₹
  stockQuantity: number;
  isAvailable: boolean;
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  isFreshToday: boolean;
  isPopular: boolean;
  variants: ProductVariant[];
}
