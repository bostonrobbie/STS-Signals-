import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  MessageSquare,
  Mail,
  Clock,
  User,
  Tag,
  RefreshCw,
  Send,
  Sparkles,
  CheckCircle2,
  Loader2,
  ChevronRight,
  Inbox,
  MessageCircle,
} from "lucide-react";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  read: "bg-muted/300/20 text-muted-foreground border-gray-500/30",
  in_progress: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  awaiting_response: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  resolved: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  closed: "bg-muted/300/20 text-muted-foreground border-gray-500/30",
};

const priorityColors: Record<string, string> = {
  low: "bg-muted/300/20 text-muted-foreground",
  normal: "bg-blue-500/20 text-blue-400",
  high: "bg-orange-500/20 text-orange-400",
  urgent: "bg-red-500/20 text-red-400",
};

const categoryLabels: Record<string, string> = {
  general: "General",
  support: "Support",
  billing: "Billing",
  feature_request: "Feature Request",
  bug_report: "Bug Report",
  partnership: "Partnership",
};

export default function ContactMessages() {
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(
    null
  );
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [responseText, setResponseText] = useState("");
  const [showResponseDialog, setShowResponseDialog] = useState(false);

  const utils = trpc.useUtils();

  const { data: listData, isLoading } = trpc.contact.list.useQuery({
    status: statusFilter === "all" ? undefined : (statusFilter as any),
    category: categoryFilter === "all" ? undefined : (categoryFilter as any),
    limit: 50,
  });

  const { data: messageDetail } = trpc.contact.get.useQuery(
    { id: selectedMessageId! },
    { enabled: !!selectedMessageId }
  );

  const updateStatusMutation = trpc.contact.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status updated");
      utils.contact.list.invalidate();
      utils.contact.get.invalidate();
    },
  });

  const createResponseMutation = trpc.contact.createResponse.useMutation({
    onSuccess: () => {
      toast.success("Response draft created");
      setResponseText("");
      setShowResponseDialog(false);
      utils.contact.get.invalidate();
    },
  });

  const approveAndSendMutation = trpc.contact.approveAndSend.useMutation({
    onSuccess: () => {
      toast.success("Response sent!");
      utils.contact.list.invalidate();
      utils.contact.get.invalidate();
    },
  });

  const regenerateAiMutation = trpc.contact.regenerateAiResponse.useMutation({
    onSuccess: data => {
      if (data.success) {
        toast.success("AI response regenerated");
        utils.contact.get.invalidate();
      } else {
        toast.error(data.error || "Failed to regenerate");
      }
    },
  });

  const messages = listData?.messages || [];
  const stats = listData?.stats;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-emerald-400" />
            Contact Messages
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage customer inquiries and support requests
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => utils.contact.list.invalidate()}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-white border-2 border-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Inbox className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {stats.new}
                  </p>
                  <p className="text-xs text-foreground/70">New</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-2 border-yellow-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/20">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {stats.inProgress}
                  </p>
                  <p className="text-xs text-foreground/70">In Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-2 border-purple-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <MessageCircle className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {stats.awaitingResponse}
                  </p>
                  <p className="text-xs text-foreground/70">
                    Awaiting Response
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-2 border-emerald-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {stats.resolved}
                  </p>
                  <p className="text-xs text-foreground/70">Resolved</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] bg-white border-border">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent className="bg-white border-border">
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="read">Read</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="awaiting_response">Awaiting Response</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px] bg-white border-border">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent className="bg-white border-border">
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="support">Support</SelectItem>
            <SelectItem value="billing">Billing</SelectItem>
            <SelectItem value="feature_request">Feature Request</SelectItem>
            <SelectItem value="bug_report">Bug Report</SelectItem>
            <SelectItem value="partnership">Partnership</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Message List */}
        <div className="lg:col-span-1 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            </div>
          ) : messages.length === 0 ? (
            <Card className="bg-white border-2 border-border">
              <CardContent className="p-8 text-center">
                <Inbox className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-foreground/70">No messages found</p>
              </CardContent>
            </Card>
          ) : (
            messages.map((msg: any) => (
              <Card
                key={msg.id}
                className={`bg-white border-2 border-border cursor-pointer transition-all hover:border-emerald-500 hover:shadow-md ${
                  selectedMessageId === msg.id
                    ? "border-emerald-500 shadow-lg"
                    : ""
                }`}
                onClick={() => setSelectedMessageId(msg.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className={
                            statusColors[msg.status] || statusColors.new
                          }
                        >
                          {msg.status.replace("_", " ")}
                        </Badge>
                        {msg.priority !== "normal" && (
                          <Badge
                            variant="outline"
                            className={priorityColors[msg.priority]}
                          >
                            {msg.priority}
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-medium text-foreground truncate">
                        {msg.subject}
                      </h3>
                      <p className="text-sm text-foreground/70 truncate">
                        {msg.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(msg.createdAt), "MMM d, h:mm a")}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Message Detail */}
        <div className="lg:col-span-2">
          {selectedMessageId && messageDetail?.message ? (
            <Card className="bg-background/50 border-border">
              <CardHeader className="border-b border-border">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-white">
                      {messageDetail.message.subject}
                    </CardTitle>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {messageDetail.message.name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        {messageDetail.message.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Tag className="w-4 h-4" />
                        {categoryLabels[messageDetail.message.category] ||
                          messageDetail.message.category}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={messageDetail.message.status}
                      onValueChange={value =>
                        updateStatusMutation.mutate({
                          id: selectedMessageId,
                          status: value as any,
                        })
                      }
                    >
                      <SelectTrigger className="w-[160px] bg-white border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-border">
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="read">Read</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="awaiting_response">
                          Awaiting Response
                        </SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Original Message */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    Message
                  </h4>
                  <div className="bg-muted/30 rounded-lg p-4 border border-border">
                    <p className="text-foreground whitespace-pre-wrap break-words">
                      {messageDetail.message.message}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Received{" "}
                    {format(
                      new Date(messageDetail.message.createdAt),
                      "MMMM d, yyyy 'at' h:mm a"
                    )}
                  </p>
                </div>

                {/* AI Suggested Response */}
                {messageDetail.message.aiSuggestedResponse && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        AI Suggested Response
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          regenerateAiMutation.mutate({
                            messageId: selectedMessageId,
                          })
                        }
                        disabled={regenerateAiMutation.isPending}
                        className="text-xs"
                      >
                        {regenerateAiMutation.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="w-3 h-3 mr-1" />
                        )}
                        Regenerate
                      </Button>
                    </div>
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                      <p className="text-gray-300 whitespace-pre-wrap break-words text-sm">
                        {messageDetail.message.aiSuggestedResponse}
                      </p>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        onClick={() => {
                          setResponseText(
                            messageDetail.message.aiSuggestedResponse || ""
                          );
                          setShowResponseDialog(true);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500"
                      >
                        Use This Response
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowResponseDialog(true)}
                      >
                        Write Custom Response
                      </Button>
                    </div>
                  </div>
                )}

                {/* Previous Responses */}
                {messageDetail.responses &&
                  messageDetail.responses.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">
                        Response History
                      </h4>
                      <div className="space-y-3">
                        {messageDetail.responses.map((resp: any) => (
                          <div
                            key={resp.id}
                            className="bg-emerald-50 rounded-lg p-4 border-l-2 border-emerald-500"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <Badge
                                variant="outline"
                                className={
                                  resp.deliveryStatus === "sent"
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : "bg-yellow-500/20 text-yellow-400"
                                }
                              >
                                {resp.deliveryStatus}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(
                                  new Date(resp.createdAt),
                                  "MMM d, h:mm a"
                                )}
                              </span>
                            </div>
                            <p className="text-gray-300 whitespace-pre-wrap break-words text-sm">
                              {resp.responseText}
                            </p>
                            {resp.deliveryStatus === "draft" && (
                              <div className="mt-3 flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    approveAndSendMutation.mutate({
                                      responseId: resp.id,
                                    })
                                  }
                                  disabled={approveAndSendMutation.isPending}
                                  className="bg-emerald-600 hover:bg-emerald-500"
                                >
                                  {approveAndSendMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                                  ) : (
                                    <Send className="w-4 h-4 mr-1" />
                                  )}
                                  Approve & Send
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* No AI response yet */}
                {!messageDetail.message.aiSuggestedResponse && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() =>
                        regenerateAiMutation.mutate({
                          messageId: selectedMessageId,
                        })
                      }
                      disabled={regenerateAiMutation.isPending}
                      variant="outline"
                      className="gap-2"
                    >
                      {regenerateAiMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      Generate AI Response
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowResponseDialog(true)}
                    >
                      Write Response
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-background/50 border-border">
              <CardContent className="p-12 text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-foreground/70" />
                <p className="text-muted-foreground">
                  Select a message to view details
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Response Dialog */}
      <Dialog open={showResponseDialog} onOpenChange={setShowResponseDialog}>
        <DialogContent className="sm:max-w-[600px] bg-background border-border">
          <DialogHeader>
            <DialogTitle className="text-white">Create Response</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Write or edit your response before sending. The response will be
              saved as a draft for your approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Textarea
              value={responseText}
              onChange={e => setResponseText(e.target.value)}
              placeholder="Type your response..."
              className="bg-white border-border text-foreground min-h-[200px]"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowResponseDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedMessageId && responseText.trim()) {
                    createResponseMutation.mutate({
                      messageId: selectedMessageId,
                      responseText: responseText.trim(),
                      isAiGenerated: false,
                    });
                  }
                }}
                disabled={
                  !responseText.trim() || createResponseMutation.isPending
                }
                className="bg-emerald-600 hover:bg-emerald-500"
              >
                {createResponseMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : null}
                Save as Draft
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
