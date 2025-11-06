/**
 * TypeScript Type Definitions for PayWall402
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Content types supported by the platform
 */
export type ContentType = 'file' | 'text' | 'link';

/**
 * Payment status types
 */
export type PaymentStatus = 'pending' | 'completed' | 'failed';

/**
 * Expiration options for content
 */
export type ExpirationOption = 'never' | '1h' | '1d' | '7d';

/**
 * Sort options for content queries
 */
export type SortOption = 'price' | 'created_at' | 'views' | 'payments';

/**
 * Order direction for sorting
 */
export type OrderDirection = 'asc' | 'desc';

// ============================================================================
// Entity Types
// ============================================================================

/**
 * Content entity representing paywalled content
 */
export interface Content {
  id: string;
  contentType: ContentType;
  contentPath?: string;
  originalFilename?: string;
  fileMimetype?: string;
  priceUsdc: number;
  creatorWallet: string;
  views: number;
  payments: number;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  title?: string;
  description?: string;
}

/**
 * Payment log entity
 */
export interface PaymentLog {
  id: string;
  contentId: string;
  payerWallet: string;
  amountUsdc: number;
  transactionSignature: string;
  paymentStatus: PaymentStatus;
  paidAt: Date;
}

/**
 * Creator statistics
 */
export interface CreatorStats {
  totalContent: number;
  totalViews: number;
  totalPayments: number;
  totalRevenue: number;
  topContent?: ContentSummary[];
}

/**
 * Content summary for listings
 */
export interface ContentSummary {
  id: string;
  contentType: ContentType;
  priceUsdc: number;
  views: number;
  payments: number;
  revenue: number;
  createdAt: Date;
  title?: string;
  thumbnail?: string;
}

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Upload request payload
 */
export interface UploadRequest {
  price: number;
  creatorWallet: string;
  expiresIn?: ExpirationOption;
  title?: string;
  description?: string;
}

/**
 * File upload request
 */
export interface FileUploadRequest extends UploadRequest {
  file: File;
}

/**
 * Text upload request
 */
export interface TextUploadRequest extends UploadRequest {
  contentType: 'text';
  textContent: string;
}

/**
 * Link upload request
 */
export interface LinkUploadRequest extends UploadRequest {
  contentType: 'link';
  linkUrl: string;
}

/**
 * Upload response
 */
export interface UploadResponse {
  success: boolean;
  contentId: string;
  shareUrl: string;
  paymentLink?: string;
  expiresAt?: Date;
}

/**
 * Payment initiation request
 */
export interface PaymentInitiationRequest {
  contentId: string;
  payerWallet?: string;
}

/**
 * Payment initiation response
 */
export interface PaymentInitiationResponse {
  success: boolean;
  paymentId: string;
  amount: number;
  recipient: string;
  memo?: string;
}

/**
 * Payment verification request
 */
export interface PaymentVerificationRequest {
  contentId: string;
  transactionSignature: string;
  payerWallet?: string;
  amount?: number;
}

/**
 * Payment verification response
 */
export interface PaymentVerificationResponse {
  success: boolean;
  verified: boolean;
  accessToken?: string;
  expiresIn?: number;
  message?: string;
}

/**
 * Content info response (public metadata)
 */
export interface ContentInfoResponse {
  id: string;
  contentType: ContentType;
  priceUsdc: number;
  creatorWallet: string;
  views: number;
  payments: number;
  expiresAt?: Date;
  createdAt: Date;
  title?: string;
  description?: string;
  preview?: string;
  expired?: boolean;
}

/**
 * Content download response
 */
export interface ContentDownloadResponse {
  success: boolean;
  contentType: ContentType;
  content?: string; // For text content
  url?: string; // For link content
  fileData?: ArrayBuffer; // For file content
  filename?: string;
  mimetype?: string;
}

/**
 * Search filters
 */
export interface SearchFilters {
  query?: string;
  type?: ContentType;
  minPrice?: number;
  maxPrice?: number;
  creator?: string;
  sort?: SortOption;
  order?: OrderDirection;
  limit?: number;
  offset?: number;
}

/**
 * Search results
 */
export interface SearchResults {
  items: ContentSummary[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ============================================================================
// API Error Types
// ============================================================================

/**
 * API error response
 */
export interface ApiError {
  success: false;
  error: {
    message: string;
    code?: string;
    statusCode: number;
    details?: any;
  };
  timestamp: string;
  requestId?: string;
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  type: string;
}

/**
 * API response with validation errors
 */
export interface ValidationErrorResponse extends ApiError {
  errors: ValidationError[];
}

// ============================================================================
// Wallet/Blockchain Types
// ============================================================================

/**
 * Wallet connection state
 */
export interface WalletState {
  connected: boolean;
  publicKey?: string;
  balance?: number;
  network?: 'mainnet-beta' | 'testnet' | 'devnet';
}

/**
 * Transaction result
 */
export interface TransactionResult {
  signature: string;
  success: boolean;
  error?: string;
  confirmedAt?: Date;
}

/**
 * USDC transfer parameters
 */
export interface UsdcTransferParams {
  from: string;
  to: string;
  amount: number;
  memo?: string;
}

// ============================================================================
// UI Component Props
// ============================================================================

/**
 * Upload form props
 */
export interface UploadFormProps {
  onSuccess?: (response: UploadResponse) => void;
  onError?: (error: ApiError) => void;
  defaultCreatorWallet?: string;
  maxFileSize?: number;
  allowedFileTypes?: string[];
}

/**
 * Paywall wrapper props
 */
export interface PaywallWrapperProps {
  contentId: string;
  onPaymentSuccess?: (token: string) => void;
  onPaymentError?: (error: Error) => void;
  children?: React.ReactNode;
}

/**
 * Content viewer props
 */
export interface ContentViewerProps {
  content: Content;
  accessToken: string;
  onDownload?: () => void;
}

/**
 * Statistics dashboard props
 */
export interface StatsDashboardProps {
  creatorWallet: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Async state for data fetching
 */
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  total?: number;
}

/**
 * File metadata
 */
export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

/**
 * Cache entry
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Payment event
 */
export interface PaymentEvent {
  type: 'payment.completed' | 'payment.failed';
  contentId: string;
  payerWallet: string;
  amount: number;
  transactionSignature: string;
  timestamp: Date;
}

/**
 * Content event
 */
export interface ContentEvent {
  type: 'content.created' | 'content.expired' | 'content.deleted';
  contentId: string;
  creatorWallet: string;
  timestamp: Date;
}

/**
 * WebSocket message
 */
export interface WSMessage<T = any> {
  type: string;
  payload: T;
  timestamp: number;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Application configuration
 */
export interface AppConfig {
  apiUrl: string;
  solanaRpcHost: string;
  x402FacilitatorUrl: string;
  maxFileSize: number;
  supportedFileTypes: string[];
  cacheTTL: number;
  rateLimit: {
    window: number;
    max: number;
  };
}

/**
 * Theme configuration
 */
export interface ThemeConfig {
  mode: 'light' | 'dark';
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
}

// ============================================================================
// Hook Return Types
// ============================================================================

/**
 * useContent hook return type
 */
export interface UseContentReturn {
  content: Content | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * usePayment hook return type
 */
export interface UsePaymentReturn {
  initiatePayment: (contentId: string) => Promise<PaymentInitiationResponse>;
  verifyPayment: (signature: string) => Promise<PaymentVerificationResponse>;
  paymentStatus: PaymentStatus | null;
  loading: boolean;
  error: Error | null;
}

/**
 * useUpload hook return type
 */
export interface UseUploadReturn {
  upload: (data: FormData) => Promise<UploadResponse>;
  uploading: boolean;
  progress: number;
  error: Error | null;
}

/**
 * useWallet hook return type
 */
export interface UseWalletReturn extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signMessage: (message: string) => Promise<string>;
  signTransaction: (transaction: any) => Promise<any>;
}

// ============================================================================
// Form Types
// ============================================================================

/**
 * Upload form values
 */
export interface UploadFormValues {
  contentType: ContentType;
  file?: File;
  textContent?: string;
  linkUrl?: string;
  price: number;
  creatorWallet: string;
  expiresIn: ExpirationOption;
  title?: string;
  description?: string;
}

/**
 * Search form values
 */
export interface SearchFormValues {
  query: string;
  type?: ContentType;
  priceRange?: [number, number];
  sortBy: SortOption;
  order: OrderDirection;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if error is an ApiError
 */
export function isApiError(error: any): error is ApiError {
  return (
    error &&
    typeof error === 'object' &&
    error.success === false &&
    'error' in error
  );
}

/**
 * Type guard to check if response has validation errors
 */
export function hasValidationErrors(
  error: any
): error is ValidationErrorResponse {
  return isApiError(error) && 'errors' in error && Array.isArray(error.errors);
}

/**
 * Type guard to check if content is expired
 */
export function isContentExpired(content: Content): boolean {
  return content.expiresAt ? new Date(content.expiresAt) < new Date() : false;
}

// ============================================================================
// Constants
// ============================================================================

export const CONTENT_TYPES: Record<ContentType, string> = {
  file: 'File',
  text: 'Text',
  link: 'Link',
};

export const PAYMENT_STATUSES: Record<PaymentStatus, string> = {
  pending: 'Pending',
  completed: 'Completed',
  failed: 'Failed',
};

export const EXPIRATION_OPTIONS: Record<ExpirationOption, string> = {
  never: 'Never',
  '1h': '1 Hour',
  '1d': '1 Day',
  '7d': '7 Days',
};

export const FILE_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB

export const SUPPORTED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/zip',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'video/mp4',
  'audio/mpeg',
];

export const PRICE_LIMITS = {
  min: 0.01,
  max: 100,
  precision: 2,
};