import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { User } from "@shared/schema";
import { validateCommuteDistance } from "@/lib/utils";

const schema = z.object({
  commuteDistance: z.number()
    .min(0.1, "Distance must be greater than 0")
    .max(200, "Distance cannot exceed 200 miles")
    .refine(
      (val) => validateCommuteDistance(val) === null,
      (val) => ({ message: validateCommuteDistance(val) || "Invalid distance" })
    ),
});

type CommuteDistanceModalProps = {
  user: User;
};

export function CommuteDistanceModal({ user }: CommuteDistanceModalProps) {
  const { toast } = useToast();
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      commuteDistance: user.commuteDistance ? parseFloat(user.commuteDistance) : 0,
    },
  });

  const setDistanceMutation = useMutation({
    mutationFn: async (data: { commuteDistance: number }) => {
      const res = await apiRequest("PATCH", `/api/users/${user.id}/commute-distance`, data);
      return res.json();
    },
    onSuccess: (updatedUser: User) => {
      queryClient.setQueryData(["/api/user"], updatedUser);
      toast({
        title: "Success",
        description: "Your commute distance has been updated",
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
    <Dialog open={!user.commuteDistance}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Welcome! Set Your Commute Distance</DialogTitle>
          <DialogDescription>
            Please enter your one-way commute distance to work in miles. This will be used to calculate your carbon credits.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => setDistanceMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="commuteDistance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Commute Distance (miles)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.1"
                      min="0.1"
                      max="200"
                      {...field}
                      onChange={e => field.onChange(parseFloat(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={setDistanceMutation.isPending}>
              Save Distance
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}