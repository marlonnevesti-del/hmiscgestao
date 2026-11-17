import { queryOptions } from "@tanstack/react-query";
import { readHotelariaBeds } from "./hotelaria-beds.functions";
import { HOTELARIA_POLL_MS } from "./hotelaria-beds";

export const hotelariaBedsQuery = queryOptions({
  queryKey: ["hotelaria", "beds"], queryFn: () => readHotelariaBeds(),
  refetchInterval: HOTELARIA_POLL_MS, refetchIntervalInBackground: true,
  staleTime: 0, retry: false,
});