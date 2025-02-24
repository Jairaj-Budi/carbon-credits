import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertOrgSchema, type User } from "@shared/schema";

type OrganizationRegistrationProps = {
  user: User;
};

export function OrganizationRegistration({ user }: OrganizationRegistrationProps) {
  const { toast } = useToast();
  const form = useForm({
    resolver: zodResolver(insertOrgSchema),
    defaultValues: {
      name: "",
      address: "",
    },
  });

  const createOrgMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/organizations", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Success",
        description: "Organization registered successfully",
      });
    },
  });

  const shouldShow = user.role === "org_admin" && !user.organizationId;

  return (
    <Dialog open={shouldShow}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register Your Organization</DialogTitle>
          <DialogDescription>
            Please provide your organization's details to complete the registration.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createOrgMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Address</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={createOrgMutation.isPending}>
              Register Organization
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
