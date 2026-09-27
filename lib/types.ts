export type ExpirationStatus = "urgente" | "pronto" | "ok";

export type FilterTab = "todos" | "caducados" | ExpirationStatus;

export type Product = {
  id: string;
  barcode: string;
  name: string;
  category: string;
  brand?: string;
  imageUrl?: string;
  expirationDate: string;
  discounted: boolean;
  price: number;
  quantity: number;
};

export type ProductDraft = {
  barcode: string;
  name: string;
  category: string;
  brand?: string;
  imageUrl?: string;
  expirationDate: string;
  price?: number;
  quantity?: number;
};

export type ImpactStats = {
  savedProducts: number;
  savedMoney: number;
  expiredProducts: number;
  expiredMoney: number;
};