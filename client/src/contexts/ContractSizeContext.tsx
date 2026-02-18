import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

export type ContractSize = "mini" | "micro";

interface ContractSizeContextType {
  contractSize: ContractSize;
  setContractSize: (size: ContractSize) => void;
  toggleContractSize: () => void;
  contractMultiplier: number;
  isLoading: boolean;
  isSaving: boolean;
}

const ContractSizeContext = createContext<ContractSizeContextType | undefined>(
  undefined
);

export function ContractSizeProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [contractSize, setContractSizeState] = useState<ContractSize>("micro");
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch user's saved preferences
  const { data: prefsData, isLoading: prefsLoading } =
    trpc.user.getPreferences.useQuery(undefined, {
      enabled: !!user && !authLoading,
    });

  // Mutation to save preferences with toast notification
  const savePreferencesMutation = trpc.user.setPreferences.useMutation({
    onSuccess: (_data, variables) => {
      if (variables.contractSize) {
        const sizeLabel = variables.contractSize === "micro" ? "Micro" : "Mini";
        toast.success(`Contract size saved: ${sizeLabel}`, {
          duration: 2000,
        });
      }
    },
    onError: error => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  // Initialize from database when user data loads
  useEffect(() => {
    if (prefsData?.contractSize && !isInitialized) {
      setContractSizeState(prefsData.contractSize);
      setIsInitialized(true);
    }
  }, [prefsData, isInitialized]);

  const setContractSize = (size: ContractSize) => {
    setContractSizeState(size);
    // Save to database if user is logged in
    if (user) {
      savePreferencesMutation.mutate({ contractSize: size });
    }
  };

  const toggleContractSize = () => {
    const newSize = contractSize === "mini" ? "micro" : "mini";
    setContractSize(newSize);
  };

  // Contract size multiplier: micro = 1/10 of mini
  const contractMultiplier = contractSize === "micro" ? 0.1 : 1;

  const isLoading = authLoading || prefsLoading;
  const isSaving = savePreferencesMutation.isPending;

  return (
    <ContractSizeContext.Provider
      value={{
        contractSize,
        setContractSize,
        toggleContractSize,
        contractMultiplier,
        isLoading,
        isSaving,
      }}
    >
      {children}
    </ContractSizeContext.Provider>
  );
}

export function useContractSize() {
  const context = useContext(ContractSizeContext);
  if (context === undefined) {
    throw new Error(
      "useContractSize must be used within a ContractSizeProvider"
    );
  }
  return context;
}
