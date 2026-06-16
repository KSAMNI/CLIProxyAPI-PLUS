// Consolidated type declarations used across the project.
// Added to fix CI TypeScript errors related to missing AmpcodeConfig and provider brand values.

export interface AmpcodeConfig {
  apiKey: string;
  projectId?: string;
  endpoint?: string;
  // Optional provider-specific mappings
  mappings?: Array<Record<string, any>>;
  // Allow additional fields if needed by consumer code
  [key: string]: any;
}

// ProviderBrand: include 'ampcode' as a valid brand value.
// Extend this union with other known brands used in the repo.
export type ProviderBrand =
  | 'aws'
  | 'gcp'
  | 'azure'
  | 'digitalocean'
  | 'hetzner'
  | 'ampcode'
  | string;

// Generic helper types that components may consume. Adjust/extend as needed.
export type Mapping = { source: string; target: string; [k: string]: any };
export type Entry = { key: string; value: any; [k: string]: any };

// Re-export any other project-wide types here as needed.
