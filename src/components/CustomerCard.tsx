import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface CustomerCardProps {
  id: string;
  full_name: string;
  phone_number: string | null;
  balance: number;
  credit_limit: number;
}

export function CustomerCard({
  id,
  full_name,
  phone_number,
  balance,
  credit_limit,
}: CustomerCardProps) {
  const balanceNumber = Number(balance);
  const limitNumber = Number(credit_limit);
  const isOverLimit = balanceNumber >= limitNumber;
  const isNearLimit = balanceNumber >= limitNumber * 0.8;

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">{full_name}</CardTitle>
        {phone_number && (
          <p className="text-sm text-gray-500 truncate">{phone_number}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-sm font-medium">
          <span>Solde</span>
          <span className={isOverLimit ? 'text-red-600' : isNearLimit ? 'text-orange-600' : 'text-green-600'}>
            {balanceNumber.toLocaleString('fr-FR')} FCFA
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span>Limite</span>
          <span>{limitNumber.toLocaleString('fr-FR')} FCFA</span>
        </div>
      </CardContent>
      {isNearLimit || isOverLimit ? (
        <CardFooter className="pt-2">
          <Badge
            variant={isOverLimit ? 'destructive' : 'secondary'}
            className="w-fit"
          >
            {isOverLimit ? 'Limite dépassée' : 'Proche de la limite'}
          </Badge>
        </CardFooter>
      ) : null}
    </Card>
  );
}