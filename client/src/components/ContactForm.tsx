import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Send, MessageSquare, CheckCircle2, Loader2 } from "lucide-react";

const categories = [
  { value: "general", label: "General Inquiry" },
  { value: "support", label: "Technical Support" },
  { value: "billing", label: "Billing Question" },
  { value: "feature_request", label: "Feature Request" },
  { value: "bug_report", label: "Bug Report" },
  { value: "partnership", label: "Partnership" },
];

interface ContactFormProps {
  trigger?: React.ReactNode;
  defaultCategory?: string;
}

export function ContactForm({
  trigger,
  defaultCategory = "general",
}: ContactFormProps) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
    category: defaultCategory,
  });

  const submitMutation = trpc.contact.submit.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Message sent successfully!");
    },
    onError: error => {
      toast.error(error.message || "Failed to send message. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.name ||
      !formData.email ||
      !formData.subject ||
      !formData.message
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.message.length < 10) {
      toast.error("Message must be at least 10 characters");
      return;
    }

    submitMutation.mutate({
      name: formData.name,
      email: formData.email,
      subject: formData.subject,
      message: formData.message,
      category: formData.category as any,
    });
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      subject: "",
      message: "",
      category: defaultCategory,
    });
    setSubmitted(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset form when dialog closes
      setTimeout(resetForm, 300);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            Contact Us
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-background border-border">
        {submitted ? (
          <div className="py-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <DialogTitle className="text-xl text-white mb-2">
              Message Sent!
            </DialogTitle>
            <DialogDescription className="text-muted-foreground mb-6">
              Thank you for reaching out. We'll get back to you as soon as
              possible.
            </DialogDescription>
            <Button
              onClick={() => handleOpenChange(false)}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-white">Contact Us</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Have a question or feedback? We'd love to hear from you.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">
                    Name *
                  </label>
                  <Input
                    placeholder="Your name"
                    value={formData.name}
                    onChange={e =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="bg-card border-border text-white"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">
                    Email *
                  </label>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={e =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="bg-card border-border text-white"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  Category
                </label>
                <Select
                  value={formData.category}
                  onValueChange={value =>
                    setFormData({ ...formData, category: value })
                  }
                >
                  <SelectTrigger className="bg-card border-border text-white">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {categories.map(cat => (
                      <SelectItem
                        key={cat.value}
                        value={cat.value}
                        className="text-white hover:bg-gray-700"
                      >
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  Subject *
                </label>
                <Input
                  placeholder="What's this about?"
                  value={formData.subject}
                  onChange={e =>
                    setFormData({ ...formData, subject: e.target.value })
                  }
                  className="bg-card border-border text-white"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  Message *
                </label>
                <Textarea
                  placeholder="Tell us more..."
                  value={formData.message}
                  onChange={e =>
                    setFormData({ ...formData, message: e.target.value })
                  }
                  className="bg-card border-border text-white min-h-[120px]"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {formData.message.length}/5000 characters
                </p>
              </div>

              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500"
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Message
                  </>
                )}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ContactForm;
