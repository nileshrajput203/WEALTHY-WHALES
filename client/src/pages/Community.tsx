import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";

export default function Community() {
  const { data } = useQuery<any>({ queryKey: ["/api/community/feed"] });
  const items = data?.items || [];
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
          <Users className="w-8 h-8 text-primary" />
          Community Group
        </h1>
        <p className="text-muted-foreground">Connect with fellow traders and investors</p>
      </div>

      {items.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((it: any) => (
            <Card key={it.id} className="overflow-hidden">
              {it.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.imageUrl} alt={it.stockName} className="w-full h-40 object-cover" />
              )}
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="font-mono">{it.stockSymbol}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${it.recommendationType === 'BUY' ? 'bg-green-500/20 text-green-400' : it.recommendationType === 'SELL' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{it.recommendationType}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm text-muted-foreground">{it.reasonToBuy}</div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div><span className="font-semibold">Current:</span> {it.currentPrice}</div>
                  <div><span className="font-semibold">Target:</span> {it.targetPrice}</div>
                  <div><span className="font-semibold">SL:</span> {it.stopLoss}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-16 pb-16 text-center">
            <Users className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">Community Features Coming Soon</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Join discussions, share insights, and learn from experienced traders
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
