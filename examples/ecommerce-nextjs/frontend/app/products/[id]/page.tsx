import { gql } from '@apollo/client';
import { ProductDetail } from '../../components/ProductDetail';

const GET_PRODUCT = gql`
  query GetProduct($id: ID!) {
    product(id: $id) {
      id
      name
      description
      price
      inventory
      category
    }
  }
`;

interface ProductDetailPageProps {
  params: {
    id: string;
  };
}

export default function ProductDetailPage({ params }: ProductDetailPageProps) {
  return <ProductDetail productId={params.id} />;
}