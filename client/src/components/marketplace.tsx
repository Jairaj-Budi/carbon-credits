import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { Organization, Listing } from "@shared/schema";
import { Loader2 } from "lucide-react";

type MarketplaceProps = {
  organization?: Organization;
};

export function Marketplace({ organization }: MarketplaceProps) {
  const { toast } = useToast();
  const [creditsAmount, setCreditsAmount] = useState("");
  const [pricePerCredit, setPricePerCredit] = useState("");

  const { data: listings } = useQuery<Listing[]>({
    queryKey: ["/api/listings"],
  });

  const createListingMutation = useMutation({
    mutationFn: async (data: { creditsAmount: number; pricePerCredit: number }) => {
      const res = await apiRequest("POST", "/api/listings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      setCreditsAmount("");
      setPricePerCredit("");
      toast({
        title: "Success",
        description: "Listing created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async (listingId: number) => {
      const res = await apiRequest("POST", `/api/purchases/${listingId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      toast({
        title: "Success",
        description: "Purchase completed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Create Listing</CardTitle>
        </CardHeader>
        <CardContent>
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (!creditsAmount || !pricePerCredit) {
                toast({
                  title: "Error",
                  description: "Please fill in all fields",
                  variant: "destructive",
                });
                return;
              }
              createListingMutation.mutate({
                creditsAmount: Number(creditsAmount),
                pricePerCredit: Number(pricePerCredit),
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="creditsAmount">Credits Amount</Label>
              <Input
                id="creditsAmount"
                type="number"
                value={creditsAmount}
                onChange={(e) => setCreditsAmount(e.target.value)}
                min="0"
                max={organization?.totalCredits}
                step="0.01"
                placeholder="Enter amount of credits to sell"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pricePerCredit">Price per Credit</Label>
              <Input
                id="pricePerCredit"
                type="number"
                value={pricePerCredit}
                onChange={(e) => setPricePerCredit(e.target.value)}
                min="0"
                step="0.01"
                placeholder="Enter price per credit"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full"
              disabled={
                createListingMutation.isPending ||
                !creditsAmount ||
                !pricePerCredit ||
                Number(creditsAmount) > (organization?.totalCredits ? parseFloat(organization.totalCredits) : 0)
              }
            >
              {createListingMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Listing
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available Listings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {listings?.filter(l => l.status === "active").map((listing) => {
              const listingAmount = parseFloat(listing.creditsAmount);
              const listingPrice = parseFloat(listing.pricePerCredit);
              const totalCost = listingAmount * listingPrice;

              return (
                <div key={listing.id} className="p-4 border rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium">Credits:</span>
                    <span>{formatNumber(listingAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Price per Credit:</span>
                    <span>{formatCurrency(listingPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Total Cost:</span>
                    <span>{formatCurrency(totalCost)}</span>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => purchaseMutation.mutate(listing.id)}
                    disabled={
                      purchaseMutation.isPending ||
                      listing.organizationId === organization?.id ||
                      (organization?.virtualBalance ? parseFloat(organization.virtualBalance) : 0) < totalCost
                    }
                  >
                    {purchaseMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {listing.organizationId === organization?.id ? "Your Listing" : "Purchase"}
                  </Button>
                </div>
              );
            })}
            {!listings?.length && (
              <p className="text-center text-muted-foreground">
                No active listings available
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}