import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, Save, Trash2, Eye } from "lucide-react";
import { useLocation } from "wouter";

interface StockRecommendation {
  id: string;
  stockSymbol: string;
  stockName: string;
  exchange: string;
  recommendationType: string;
  reasonToBuy: string;
  targetPrice: string;
  stopLoss: string;
  currentPrice: string;
  imageUrl?: string;
  createdAt: string;
}

export default function AdminPanel() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    stockSymbol: "",
    stockName: "",
    exchange: "NSE",
    recommendationType: "BUY",
    reasonToBuy: "",
    targetPrice: "",
    stopLoss: "",
    currentPrice: "",
    imageUrl: ""
  });

  // Fetch existing recommendations from community feed
  const { data: recommendationsRaw } = useQuery<any>({
    queryKey: ["/api/community/feed"],
  });
  const recommendationsData = Array.isArray(recommendationsRaw?.items)
    ? recommendationsRaw.items
    : (Array.isArray(recommendationsRaw) ? recommendationsRaw : []);
  const recommendations: StockRecommendation[] = Array.isArray(recommendationsData)
    ? recommendationsData
    : [];

  // Create new recommendation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create recommendation");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/community/feed"] });
      setFormData({
        stockSymbol: "",
        stockName: "",
        exchange: "NSE",
        recommendationType: "BUY",
        reasonToBuy: "",
        targetPrice: "",
        stopLoss: "",
        currentPrice: "",
        imageUrl: ""
      });
    },
  });

  // Delete recommendation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/recommendations/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete recommendation");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/feed"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { ...formData };
    if (!payload.imageUrl) delete payload.imageUrl; // avoid inserting missing column
    createMutation.mutate(payload);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this recommendation?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-muted-foreground">Manage community stock recommendations</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setLocation("/community")}
            className="flex items-center gap-2"
          >
            <Eye className="w-4 h-4" />
            View Community
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Create New Post */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Create Stock Recommendation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="stockSymbol">Stock Symbol</Label>
                    <Input
                      id="stockSymbol"
                      value={formData.stockSymbol}
                      onChange={(e) => handleInputChange("stockSymbol", e.target.value)}
                      placeholder="e.g., RELIANCE"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="stockName">Stock Name</Label>
                    <Input
                      id="stockName"
                      value={formData.stockName}
                      onChange={(e) => handleInputChange("stockName", e.target.value)}
                      placeholder="e.g., Reliance Industries"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="exchange">Exchange</Label>
                    <Select value={formData.exchange} onValueChange={(value) => handleInputChange("exchange", value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NSE">NSE</SelectItem>
                        <SelectItem value="BSE">BSE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="recommendationType">Recommendation</Label>
                    <Select value={formData.recommendationType} onValueChange={(value) => handleInputChange("recommendationType", value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BUY">BUY</SelectItem>
                        <SelectItem value="SELL">SELL</SelectItem>
                        <SelectItem value="HOLD">HOLD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="reasonToBuy">Reasoning</Label>
                  <Textarea
                    id="reasonToBuy"
                    value={formData.reasonToBuy}
                    onChange={(e) => handleInputChange("reasonToBuy", e.target.value)}
                    placeholder="Explain why this is a good investment..."
                    rows={3}
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="currentPrice">Current Price</Label>
                    <Input
                      id="currentPrice"
                      type="number"
                      value={formData.currentPrice}
                      onChange={(e) => handleInputChange("currentPrice", e.target.value)}
                      placeholder="2500"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="targetPrice">Target Price</Label>
                    <Input
                      id="targetPrice"
                      type="number"
                      value={formData.targetPrice}
                      onChange={(e) => handleInputChange("targetPrice", e.target.value)}
                      placeholder="3000"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="stopLoss">Stop Loss</Label>
                    <Input
                      id="stopLoss"
                      type="number"
                      value={formData.stopLoss}
                      onChange={(e) => handleInputChange("stopLoss", e.target.value)}
                      placeholder="2200"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="imageUrl">Image URL (Optional)</Label>
                  <Input
                    id="imageUrl"
                    value={formData.imageUrl}
                    onChange={(e) => handleInputChange("imageUrl", e.target.value)}
                    placeholder="https://example.com/stock-chart.png"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating..." : "Create Recommendation"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Existing Posts */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Posts ({recommendations.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {(Array.isArray(recommendations) ? recommendations : []).map((rec) => (
                  <div key={rec.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{rec.stockSymbol}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          rec.recommendationType === 'BUY' ? 'bg-green-500/20 text-green-400' : 
                          rec.recommendationType === 'SELL' ? 'bg-red-500/20 text-red-400' : 
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {rec.recommendationType}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(rec.createdAt).toLocaleDateString()}
                        </span>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(rec.id)}
                          disabled={deleteMutation.isPending}
                          className="h-6 w-6 p-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">{rec.reasonToBuy}</div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div><span className="font-semibold">Current:</span> ₹{rec.currentPrice}</div>
                      <div><span className="font-semibold">Target:</span> ₹{rec.targetPrice}</div>
                      <div><span className="font-semibold">SL:</span> ₹{rec.stopLoss}</div>
                    </div>
                  </div>
                ))}
                {recommendations.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No recommendations yet. Create your first post!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Self-Improving Genome Optimizer Dashboard */}
        <Card className="w-full mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-indigo-500 bg-clip-text text-transparent">
                🧠 Meta-Genome Optimizer (Self-Improving Core)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              These neural-genetic genomes evolve scanner filtering rules, confidence thresholds, weights, and holding times by matching predicted moves against actual market returns. Mutated versions are promoted when they yield a statistically significant boost in expected return.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Swing Scanner Engine */}
              <SwingGenomeCard queryClient={queryClient} />

              {/* IPO Radar Engine */}
              <IpoGenomeCard queryClient={queryClient} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SwingGenomeCard({ queryClient }: { queryClient: any }) {
  const { data: status, isLoading } = useQuery<any>({
    queryKey: ["/api/swing/genome-status"],
  });

  const evolveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/swing/evolve", { method: "POST" });
      if (!response.ok) throw new Error("Evolution failed");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/swing/genome-status"] });
      alert(data.promoted 
        ? `✅ Success! Promoted to new Genome Version. Avg Return: ${data.oldAvgReturn.toFixed(2)}% → ${data.newAvgReturn.toFixed(2)}%.` 
        : `⬤ Optimization complete. No promotion made (improvement was below significance threshold).`
      );
    },
    onError: (err: any) => {
      alert(`Error running learning cycle: ${err.message}`);
    }
  });

  if (isLoading || !status) return <div className="p-4 border rounded-lg text-center animate-pulse">Loading Swing Genome...</div>;

  return (
    <div className="border rounded-xl p-5 bg-card/50 space-y-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg text-primary flex items-center gap-2">
            🚀 Swing Watch Genome
          </h3>
          <span className="text-xs font-mono bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/20">
            Version {status.genomeVersion}
          </span>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          disabled={evolveMutation.isPending}
          onClick={() => evolveMutation.mutate()}
          className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 transition-colors"
        >
          {evolveMutation.isPending ? "Evolving..." : "Trigger Evolution"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="bg-background/40 p-2 rounded-lg">
          <span className="text-muted-foreground block">Genome Expected Return</span>
          <span className="text-base font-bold text-green-400">+{parseFloat(status.avgReturn || "0").toFixed(2)}%</span>
        </div>
        <div className="bg-background/40 p-2 rounded-lg">
          <span className="text-muted-foreground block">Completed Outcomes</span>
          <span className="text-base font-bold text-foreground">{status.completedOutcomes} trades</span>
        </div>
      </div>

      <div>
        <span className="text-xs text-muted-foreground font-semibold block mb-2">Active DNA Parameters:</span>
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="flex justify-between border-b py-1">
            <span className="text-muted-foreground">Min Grade Score:</span>
            <span className="text-foreground">{(status.params.min_grade_score ?? 65).toFixed(1)}</span>
          </div>
          <div className="flex justify-between border-b py-1">
            <span className="text-muted-foreground">ATR Tightness Max:</span>
            <span className="text-foreground">{(status.params.atr_tightness_max ?? 0.06).toFixed(3)}</span>
          </div>
          <div className="flex justify-between border-b py-1">
            <span className="text-muted-foreground">Dryup Vol Max:</span>
            <span className="text-foreground">{(status.params.volume_dryup_max ?? 0.85).toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-b py-1">
            <span className="text-muted-foreground">Max Hold Days:</span>
            <span className="text-foreground">{(status.params.max_hold_days ?? 10).toFixed(0)}d</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function IpoGenomeCard({ queryClient }: { queryClient: any }) {
  const { data: status, isLoading } = useQuery<any>({
    queryKey: ["/api/ipo/genome-status"],
  });

  const evolveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/ipo/evolve", { method: "POST" });
      if (!response.ok) throw new Error("Evolution failed");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ipo/genome-status"] });
      alert(data.promoted 
        ? `✅ Success! Promoted to new Genome Version. Avg Return: ${data.oldAvgReturn.toFixed(2)}% → ${data.newAvgReturn.toFixed(2)}%.` 
        : `⬤ Optimization complete. No promotion made (improvement was below significance threshold).`
      );
    },
    onError: (err: any) => {
      alert(`Error running learning cycle: ${err.message}`);
    }
  });

  if (isLoading || !status) return <div className="p-4 border rounded-lg text-center animate-pulse">Loading IPO Genome...</div>;

  return (
    <div className="border rounded-xl p-5 bg-card/50 space-y-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg text-primary flex items-center gap-2">
            🎯 IPO Radar Genome
          </h3>
          <span className="text-xs font-mono bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-500/20">
            Version {status.genomeVersion}
          </span>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          disabled={evolveMutation.isPending}
          onClick={() => evolveMutation.mutate()}
          className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-colors"
        >
          {evolveMutation.isPending ? "Evolving..." : "Trigger Evolution"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="bg-background/40 p-2 rounded-lg">
          <span className="text-muted-foreground block">Genome Expected Return</span>
          <span className="text-base font-bold text-green-400">+{parseFloat(status.avgReturn || "0").toFixed(2)}%</span>
        </div>
        <div className="bg-background/40 p-2 rounded-lg">
          <span className="text-muted-foreground block">Completed Outcomes</span>
          <span className="text-base font-bold text-foreground">{status.completedOutcomes} trades</span>
        </div>
      </div>

      <div>
        <span className="text-xs text-muted-foreground font-semibold block mb-2">Active DNA Parameters:</span>
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="flex justify-between border-b py-1">
            <span className="text-muted-foreground">Min IPO Score:</span>
            <span className="text-foreground">{(status.params.min_score_threshold ?? 50).toFixed(1)}</span>
          </div>
          <div className="flex justify-between border-b py-1">
            <span className="text-muted-foreground">Max Base Depth:</span>
            <span className="text-foreground">{((status.params.max_base_depth_pct ?? 0.35) * 100).toFixed(1)}%</span>
          </div>
          <div className="flex justify-between border-b py-1">
            <span className="text-muted-foreground">Consol. Range:</span>
            <span className="text-foreground">{((status.params.consolidation_range_pct ?? 0.15) * 100).toFixed(1)}%</span>
          </div>
          <div className="flex justify-between border-b py-1">
            <span className="text-muted-foreground">Min Avg Volume:</span>
            <span className="text-foreground">{(status.params.min_avg_volume ?? 5000).toFixed(0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
