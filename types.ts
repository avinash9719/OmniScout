
export type ResourceType = 'all' | 'books' | 'research' | 'media' | 'audio' | 'code' | 'social' | 'library';

export interface SearchResult {
  id: string;
  title: string;
  description: string;
  sourceUrl: string;
  type: ResourceType;
  tags?: string[];
  savedAt?: number;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ScoutResponse {
  answer: string;
  results: SearchResult[];
  sources: GroundingSource[];
}

export interface ScoutLog {
  query: string;
  timestamp: number;
  resultCount: number;
  type: ResourceType;
}

export interface ScoutProgress {
  percent: number;
  status: string;
}
