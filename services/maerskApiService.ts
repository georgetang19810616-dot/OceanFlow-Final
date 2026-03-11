import { Booking } from '../types';

const MAERSK_CONSUMER_KEY = 'VPCkL0LnJe86P0ae67Ut5IswozulyiqW';
const MAERSK_SECRET = 'bSBrcREC2LfQu4Pq';
const API_BASE = 'https://api.maersk.com/track-and-trace-private';
const TOKEN_URL = 'https://api.maersk.com/oauth2/access_token';

interface MaerskRefreshResult {
  etd?: string;
  vessel?: string;
  gateInDate?: string;
  error?: string;
}

export const maerskApiService = {
  /**
   * Fetches an OAuth2 Access Token from Maersk
   */
  async getAccessToken(): Promise<string> {
    const params = new URLSearchParams();
    params.append('client_id', MAERSK_CONSUMER_KEY);
    params.append('client_secret', MAERSK_SECRET);
    params.append('grant_type', 'client_credentials');

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    if (!response.ok) {
      throw new Error('Failed to authenticate with Maersk API');
    }

    const data = await response.json();
    return data.access_token;
  },

  /**
   * Fetches events for a specific booking reference and parses them
   */
  async refreshBookingTracking(bookingRef: string): Promise<MaerskRefreshResult> {
    if (!bookingRef) return { error: 'No booking reference provided' };

    try {
      const token = await this.getAccessToken();
      const url = `${API_BASE}/events?carrierBookingReference=${bookingRef}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Consumer-Key': MAERSK_CONSUMER_KEY,
          'Accept': 'application/json'
        },
      });

      if (response.status === 404) {
        return { error: 'Shipment not found or access denied for this party.' };
      }

      if (!response.ok) {
        return { error: `API Error: ${response.statusText}` };
      }

      const data = await response.json();
      // 假设返回的数据结构如您提供的示例
      // 注意：这里需要根据实际返回调整
      let etd: string | undefined;
      let vessel: string | undefined;
      let gateInDate: string | undefined;

      // 解析 data，提取所需信息
      if (data.containers && Array.isArray(data.containers)) {
        for (const container of data.containers) {
          if (container.locations && Array.isArray(container.locations)) {
            for (const location of container.locations) {
              if (location.events && Array.isArray(location.events)) {
                for (const event of location.events) {
                  if (event.activity === "CONTAINER DEPARTURE") {
                    if (event.event_time) {
                      const date = new Date(event.event_time);
                      etd = date.toISOString().split('T')[0];
                    }
                    if (event.vessel_name && event.voyage_num) {
                      vessel = `${event.vessel_name} / ${event.voyage_num}`;
                    }
                  } else if (event.activity === "GATE-IN") {
                    if (event.event_time) {
                      const date = new Date(event.event_time);
                      gateInDate = date.toISOString().split('T')[0];
                    }
                  }
                }
              }
            }
          }
        }
      }

      return { etd, vessel, gateInDate };
    } catch (err: any) {
      console.error('Maersk Refresh Error:', err);
      return { error: err.message };
    }
  }
};