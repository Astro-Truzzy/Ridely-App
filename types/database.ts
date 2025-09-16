export interface Database {
  public: {
    Tables: {
      riders: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          phone: string;
          vehicle_type: string | null;
          plate_number: string | null;
          license_status: 'pending' | 'verified' | 'expired';
          insurance_status: 'pending' | 'verified' | 'expired';
          background_check: 'pending' | 'verified' | 'failed';
          rating: number;
          total_deliveries: number;
          is_available: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          full_name: string;
          phone: string;
          vehicle_type?: string | null;
          plate_number?: string | null;
          license_status?: 'pending' | 'verified' | 'expired';
          insurance_status?: 'pending' | 'verified' | 'expired';
          background_check?: 'pending' | 'verified' | 'failed';
          rating?: number;
          total_deliveries?: number;
          is_available?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          phone?: string;
          vehicle_type?: string | null;
          plate_number?: string | null;
          license_status?: 'pending' | 'verified' | 'expired';
          insurance_status?: 'pending' | 'verified' | 'expired';
          background_check?: 'pending' | 'verified' | 'failed';
          rating?: number;
          total_deliveries?: number;
          is_available?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          phone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          full_name: string;
          phone: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          phone?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      deliveries: {
        Row: {
          id: string;
          rider_id: string | null;
          user_id: string;
          pickup_address: string;
          dropoff_address: string;
          parcel_size: 'small' | 'medium' | 'large';
          status: 'pending' | 'rider_assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
          total_cost: number;
          distance: number;
          estimated_time: string;
          delivery_time: 'now' | 'scheduled';
          scheduled_time: string | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          rider_id?: string | null;
          user_id: string;
          pickup_address: string;
          dropoff_address: string;
          parcel_size: 'small' | 'medium' | 'large';
          status?: 'pending' | 'rider_assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
          total_cost: number;
          distance: number;
          estimated_time: string;
          delivery_time: 'now' | 'scheduled';
          scheduled_time?: string | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          rider_id?: string | null;
          user_id?: string;
          pickup_address?: string;
          dropoff_address?: string;
          parcel_size?: 'small' | 'medium' | 'large';
          status?: 'pending' | 'rider_assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
          total_cost?: number;
          distance?: number;
          estimated_time?: string;
          delivery_time?: 'now' | 'scheduled';
          scheduled_time?: string | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
      };
      earnings: {
        Row: {
          id: string;
          delivery_id: string;
          rider_id: string;
          gross_amount: number;
          ridely_fee: number;
          net_amount: number;
          status: 'pending' | 'completed' | 'paid';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          delivery_id: string;
          rider_id: string;
          gross_amount: number;
          ridely_fee: number;
          net_amount: number;
          status?: 'pending' | 'completed' | 'paid';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          delivery_id?: string;
          rider_id?: string;
          gross_amount?: number;
          ridely_fee?: number;
          net_amount?: number;
          status?: 'pending' | 'completed' | 'paid';
          created_at?: string;
          updated_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          rider_id: string | null;
          type: 'job_request' | 'payment' | 'system' | 'delivery_update';
          title: string;
          message: string;
          read: boolean;
          actionable: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          rider_id?: string | null;
          type: 'job_request' | 'payment' | 'system' | 'delivery_update';
          title: string;
          message: string;
          read?: boolean;
          actionable?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          rider_id?: string | null;
          type?: 'job_request' | 'payment' | 'system' | 'delivery_update';
          title?: string;
          message?: string;
          read?: boolean;
          actionable?: boolean;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}