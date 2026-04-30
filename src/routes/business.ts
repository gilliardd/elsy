import { Router } from 'express';
import { requireUser } from '../middlewares/auth';
import {
  // customers
  listCustomersEndpoint,
  getCustomerEndpoint,
  createCustomerEndpoint,
  updateCustomerEndpoint,
  deleteCustomerEndpoint,
  // services
  listServicesEndpoint,
  createServiceEndpoint,
  updateServiceEndpoint,
  deleteServiceEndpoint,
  // receivables
  listReceivablesEndpoint,
  createReceivableEndpoint,
  payReceivableEndpoint,
  deleteReceivableEndpoint,
  // cash
  cashSummaryEndpoint,
  createCashMovementEndpoint,
  // dashboard
  dashboardEndpoint,
} from '../controllers/businessController';

const router = Router();

router.use(requireUser);

// Dashboard PJ
router.get('/dashboard', dashboardEndpoint);

// Customers
router.get('/customers', listCustomersEndpoint);
router.get('/customers/:id', getCustomerEndpoint);
router.post('/customers', createCustomerEndpoint);
router.put('/customers/:id', updateCustomerEndpoint);
router.delete('/customers/:id', deleteCustomerEndpoint);

// Services
router.get('/services', listServicesEndpoint);
router.post('/services', createServiceEndpoint);
router.put('/services/:id', updateServiceEndpoint);
router.delete('/services/:id', deleteServiceEndpoint);

// Receivables
router.get('/receivables', listReceivablesEndpoint);
router.post('/receivables', createReceivableEndpoint);
router.post('/receivables/:id/pay', payReceivableEndpoint);
router.delete('/receivables/:id', deleteReceivableEndpoint);

// Cash
router.get('/cash', cashSummaryEndpoint);
router.post('/cash', createCashMovementEndpoint);

export default router;
