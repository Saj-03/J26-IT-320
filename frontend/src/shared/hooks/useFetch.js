import { useEffect, useState, useCallback } from "react";
import api from "../api/client";

export default function useFetch(url) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    api.get(url).then((r) => setData(r.data)).catch(setError).finally(() => setLoading(false));
  }, [url]);

  useEffect(reload, [reload]);
  return { data, error, loading, reload };
}
