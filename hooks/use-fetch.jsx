import { useState } from "react";
import { toast } from "sonner";

// this custom hook is used to fetch data from an API or perform any async operation
const useFetch = (cb) => {
  const [data, setData] = useState(undefined); // for data fields while submitting the form
  const [loading, setLoading] = useState(null); // to show loading while fetching data or api call after submitting the form
  const [error, setError] = useState(null); // to show error if any while fetching data or api call after submitting the form

  const fn = async (...args) => {
    setLoading(true);
    setError(null);

    try {
      const response = await cb(...args);
      setData(response);
      setError(null);
    } catch (error) {
      setError(error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, fn, setData };
};

export default useFetch;
