-- =============================================================================
-- Rider demand heatmap: aggregate pending deliveries by pickup grid cell.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_demand_heatmap()
RETURNS TABLE (
  latitude double precision,
  longitude double precision,
  weight integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only riders can call this
  IF NOT EXISTS (SELECT 1 FROM public.riders WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Only riders can view demand heatmap';
  END IF;

  RETURN QUERY
  SELECT
    round(d.pickup_lat::numeric, 2)::double precision AS latitude,
    round(d.pickup_lng::numeric, 2)::double precision AS longitude,
    count(*)::integer AS weight
  FROM public.deliveries d
  WHERE d.status = 'pending'
    AND d.rider_id IS NULL
    AND d.pickup_lat IS NOT NULL
    AND d.pickup_lng IS NOT NULL
  GROUP BY round(d.pickup_lat::numeric, 2), round(d.pickup_lng::numeric, 2);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_demand_heatmap() TO authenticated;
