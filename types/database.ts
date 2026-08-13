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
          is_online: boolean;
          location: unknown | null;
          account_verification_status: 'not_submitted' | 'pending' | 'verified' | 'rejected';
          created_at: string;
          updated_at: string;
          avatar_url: string | null;
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
          is_online?: boolean;
          location?: unknown | null;
          account_verification_status?: 'not_submitted' | 'pending' | 'verified' | 'rejected';
          created_at?: string;
          updated_at?: string;
          avatar_url?: string | null;
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
          is_online?: boolean;
          location?: unknown | null;
          account_verification_status?: 'not_submitted' | 'pending' | 'verified' | 'rejected';
          created_at?: string;
          updated_at?: string;
          avatar_url?: string | null;
        };
      };
      rider_verification_documents: {
        Row: {
          id: string;
          rider_id: string;
          document_type: 'nin' | 'guarantor_letter' | 'drivers_license' | 'vehicle_registration' | 'other';
          file_path: string;
          file_name: string | null;
          review_status: 'pending' | 'approved' | 'rejected';
          admin_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          rider_id: string;
          document_type: 'nin' | 'guarantor_letter' | 'drivers_license' | 'vehicle_registration' | 'other';
          file_path: string;
          file_name?: string | null;
          review_status?: 'pending' | 'approved' | 'rejected';
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          rider_id?: string;
          document_type?: 'nin' | 'guarantor_letter' | 'drivers_license' | 'vehicle_registration' | 'other';
          file_path?: string;
          file_name?: string | null;
          review_status?: 'pending' | 'approved' | 'rejected';
          admin_notes?: string | null;
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
          avatar_url: string | null;
        };
        Insert: {
          id?: string;
          email: string;
          full_name: string;
          phone: string;
          created_at?: string;
          updated_at?: string;
          avatar_url?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          phone?: string;
          created_at?: string;
          updated_at?: string;
          avatar_url?: string | null;
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
          status: 'pending' | 'rider_assigned' | 'accepted' | 'picked_up' | 'in_transit' | 'nearby' | 'delivered' | 'completed' | 'cancelled' | 'cancelled_no_rider';
          total_cost: number;
          distance: number;
          estimated_time: string;
          delivery_time: 'now' | 'scheduled';
          scheduled_time: string | null;
          payment_method: 'cash' | 'card' | 'wallet';
          payment_status: 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';
          payment_reference: string | null;
          amount_paid: number | null;
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
          status?: 'pending' | 'rider_assigned' | 'accepted' | 'picked_up' | 'in_transit' | 'delivered' | 'completed' | 'cancelled' | 'cancelled_no_rider';
          total_cost: number;
          distance: number;
          estimated_time: string;
          delivery_time: 'now' | 'scheduled';
          scheduled_time?: string | null;
          payment_method?: 'cash' | 'card' | 'wallet';
          payment_status?: 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';
          payment_reference?: string | null;
          amount_paid?: number | null;
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
          status?: 'pending' | 'rider_assigned' | 'accepted' | 'picked_up' | 'in_transit' | 'delivered' | 'completed' | 'cancelled' | 'cancelled_no_rider';
          total_cost?: number;
          distance?: number;
          estimated_time?: string;
          delivery_time?: 'now' | 'scheduled';
          scheduled_time?: string | null;
          payment_method?: 'cash' | 'card' | 'wallet';
          payment_status?: 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';
          payment_reference?: string | null;
          amount_paid?: number | null;
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
      find_nearby_riders: {
        Args: { pickup_lat: number; pickup_lng: number; radius?: number };
        Returns: { id: string; distance: number }[];
      };
      accept_delivery: {
        Args: { p_delivery_id: string };
        Returns: Database['public']['Tables']['deliveries']['Row'];
      };
      update_rider_location: {
        Args: { lat: number; lng: number };
        Returns: void;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}