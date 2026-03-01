import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { translations } from "@/lib/translations";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Briefcase, Info, TrendingUp, TrendingDown, Minus, PieChart as PieChartIcon, List } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";
import type { SuperInvestor } from "@shared/super-investor";

export default function SuperInvestors() {
  const { data: user } = useUser();
  const lang = (user?.language || "en") as keyof typeof translations;
  const t = translations[lang];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: investors, isLoading } = useQuery<SuperInvestor[]>({
    queryKey: ["/api/super-investors"],
  });

  const selectedInvestor = investors?.find((inv) => inv.id === selectedId);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-10 w-64 bg-muted animate-pulse rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="h-48 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <AnimatePresence mode="wait">
        {!selectedId ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
                <Briefcase className="w-8 h-8 text-primary" />
                {t.super_investors}
              </h1>
              <p className="text-muted-foreground mt-2 max-w-2xl">
                {t.super_investors_desc}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {investors?.map((investor) => (
                <Card 
                  key={investor.id}
                  className="group hover:border-primary/50 transition-all cursor-pointer overflow-hidden border-2"
                  onClick={() => setSelectedId(investor.id)}
                  data-testid={`card-investor-${investor.id}`}
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shadow-lg"
                        style={{ backgroundColor: investor.avatarColor }}
                      >
                        {investor.initials}
                      </div>
                      <div>
                        <CardTitle className="text-xl group-hover:text-primary transition-colors">
                          {investor.name}
                        </CardTitle>
                        <CardDescription className="font-medium">
                          {investor.firm}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-4">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                            {t.portfolio_value}
                          </p>
                          <p className="text-2xl font-display font-bold text-primary">
                            {investor.country === "US" ? "$" : "₩"}{investor.aum}{investor.aumUnit}
                          </p>
                        </div>
                        <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary">
                          {investor.country}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(lang === "ko" ? investor.styleTagsKo : investor.styleTagsEn).slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px] font-bold uppercase tracking-tighter">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <Button className="w-full rounded-xl font-bold" data-testid={`button-view-${investor.id}`}>
                        {t.view_portfolio}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <Button 
              variant="ghost" 
              onClick={() => setSelectedId(null)}
              className="group -ml-2 text-muted-foreground hover:text-primary transition-colors"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              {t.back}
            </Button>

            {selectedInvestor && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Profile Section */}
                <div className="lg:col-span-1 space-y-6">
                  <Card className="border-2 shadow-xl overflow-hidden">
                    <div 
                      className="h-32 w-full relative"
                      style={{ backgroundColor: selectedInvestor.avatarColor + '20' }}
                    >
                      <div className="absolute -bottom-10 left-6">
                        <div 
                          className="w-24 h-24 rounded-3xl flex items-center justify-center text-4xl font-bold text-white shadow-2xl border-4 border-card"
                          style={{ backgroundColor: selectedInvestor.avatarColor }}
                        >
                          {selectedInvestor.initials}
                        </div>
                      </div>
                    </div>
                    <CardHeader className="pt-14 pb-4">
                      <CardTitle className="text-2xl">{selectedInvestor.name}</CardTitle>
                      <CardDescription className="text-lg font-semibold text-primary">
                        {selectedInvestor.firm}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <h4 className="text-sm font-bold uppercase text-muted-foreground">{t.biography}</h4>
                        <p className="text-sm leading-relaxed text-foreground/80">
                          {lang === "ko" ? selectedInvestor.biographyKo : selectedInvestor.biographyEn}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-sm font-bold uppercase text-muted-foreground">{t.investment_style}</h4>
                        <p className="text-sm leading-relaxed text-foreground/80 p-3 bg-muted rounded-xl border border-border/50 italic">
                          "{lang === "ko" ? selectedInvestor.styleKo : selectedInvestor.styleEn}"
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(lang === "ko" ? selectedInvestor.styleTagsKo : selectedInvestor.styleTagsEn).map((tag) => (
                          <Badge key={tag} className="bg-primary/10 text-primary hover:bg-primary/20 border-none px-3 py-1">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Portfolio Content */}
                <div className="lg:col-span-2 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-primary text-primary-foreground border-none shadow-lg">
                      <CardContent className="pt-6">
                        <p className="text-sm font-bold uppercase opacity-80">{t.portfolio_value}</p>
                        <p className="text-4xl font-display font-bold mt-1">
                          {selectedInvestor.country === "US" ? "$" : "₩"}{selectedInvestor.aum}{selectedInvestor.aumUnit}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border-2">
                      <CardContent className="pt-6">
                        <p className="text-sm font-bold uppercase text-muted-foreground">{t.last_updated}</p>
                        <p className="text-2xl font-display font-bold text-foreground mt-1">
                          {selectedInvestor.lastUpdated}
                        </p>
                        <p className="text-xs text-muted-foreground font-medium mt-1">{selectedInvestor.filingType}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Tabs defaultValue="holdings" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 h-12 bg-muted p-1 rounded-xl">
                      <TabsTrigger value="holdings" className="rounded-lg font-bold">
                        <List className="w-4 h-4 mr-2" />
                        {t.top_holdings}
                      </TabsTrigger>
                      <TabsTrigger value="allocation" className="rounded-lg font-bold">
                        <PieChartIcon className="w-4 h-4 mr-2" />
                        {t.sector_allocation}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="holdings" className="mt-6">
                      <Card className="border-2 overflow-hidden">
                        <ScrollArea className="h-[500px] w-full">
                          <div className="min-w-[600px]">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50 sticky top-0 z-10">
                                <tr>
                                  <th className="px-6 py-4 text-left font-bold text-muted-foreground uppercase tracking-wider">{t.company}</th>
                                  <th className="px-6 py-4 text-right font-bold text-muted-foreground uppercase tracking-wider">{t.weight}</th>
                                  <th className="px-6 py-4 text-center font-bold text-muted-foreground uppercase tracking-wider">{t.change}</th>
                                  <th className="px-6 py-4 text-right font-bold text-muted-foreground uppercase tracking-wider">{t.why_bought}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {selectedInvestor.holdings.map((holding) => (
                                  <tr key={holding.ticker} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-6 py-4">
                                      <div>
                                        <div className="font-bold text-foreground">{holding.company}</div>
                                        <div className="text-xs font-medium text-muted-foreground tracking-widest">{holding.ticker}</div>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                      <div className="text-lg font-display font-bold text-primary">{holding.weight}%</div>
                                      <div className="text-[10px] text-muted-foreground font-medium uppercase">{holding.sector}</div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                      <div className="flex flex-col items-center gap-1">
                                        {holding.change === "Bought" && <Badge className="bg-emerald-500 hover:bg-emerald-600 border-none"><TrendingUp className="w-3 h-3 mr-1" /> {t.bought}</Badge>}
                                        {holding.change === "Sold" && <Badge className="bg-rose-500 hover:bg-rose-600 border-none"><TrendingDown className="w-3 h-3 mr-1" /> {t.sold}</Badge>}
                                        {holding.change === "Held" && <Badge variant="secondary" className="bg-muted text-muted-foreground border-none"><Minus className="w-3 h-3 mr-1" /> {t.held}</Badge>}
                                        {holding.change === "New" && <Badge className="bg-primary hover:bg-primary/90 border-none">{t.new_pos}</Badge>}
                                        {holding.changePct && (
                                          <span className={holding.changePct > 0 ? "text-emerald-500 text-[10px] font-bold" : "text-rose-500 text-[10px] font-bold"}>
                                            {holding.changePct > 0 ? "+" : ""}{holding.changePct}%
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button variant="outline" size="sm" className="rounded-full h-8 font-bold border-2 hover:bg-primary hover:text-white hover:border-primary transition-all">
                                              <Info className="w-4 h-4 mr-2" />
                                              {t.learn_why}
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent className="max-w-xs p-4 bg-card border-2 shadow-2xl rounded-2xl" side="left">
                                            <div className="space-y-2">
                                              <p className="text-xs font-bold uppercase text-primary tracking-wider">{t.why_bought}</p>
                                              <p className="text-sm leading-relaxed">
                                                {lang === "ko" ? holding.whyTheyBoughtKo : holding.whyTheyBoughtEn}
                                              </p>
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </ScrollArea>
                      </Card>
                    </TabsContent>

                    <TabsContent value="allocation" className="mt-6">
                      <Card className="border-2 p-6">
                        <div className="h-[400px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={selectedInvestor.sectorAllocation}
                                cx="50%"
                                cy="50%"
                                innerRadius={80}
                                outerRadius={140}
                                paddingAngle={5}
                                dataKey="weight"
                                nameKey="sector"
                              >
                                {selectedInvestor.sectorAllocation.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                ))}
                              </Pie>
                              <RechartsTooltip 
                                contentStyle={{ borderRadius: '16px', border: '2px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                itemStyle={{ fontWeight: 'bold' }}
                              />
                              <Legend 
                                verticalAlign="bottom" 
                                height={36}
                                formatter={(value) => <span className="text-sm font-bold text-foreground">{value}</span>}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
