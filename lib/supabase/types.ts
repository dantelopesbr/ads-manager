export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface MetaAdsConversion {
  id: number
  created_at: string
  ads_id: string | null
  phone_client: string | null
  click_id: string | null
  source_url: string | null
  phone_company: string | null
  data_sent: string | null
  campaign_id: string | null
  campaign_name: string | null
  adset_id: string | null
  adset_name: string | null
  ad_name: string | null
}

export interface MetaInsight {
  id: number
  date: string
  campaign_id: string
  campaign_name: string | null
  adset_id: string
  adset_name: string | null
  ad_id: string
  ad_name: string | null
  spend: number | null
  impressions: number | null
  clicks: number | null
  reach: number | null
  synced_at: string
}

export interface HubspotContact {
  id: number
  phone: string
  hs_contact_id: string | null
  lifecycle_stage: string | null
  deal_value: number | null
  deal_stage: string | null
  updated_at: string
}

export interface SyncLog {
  id: number
  type: 'meta' | 'hubspot'
  status: 'success' | 'error'
  message: string | null
  records_synced: number | null
  created_at: string
}
