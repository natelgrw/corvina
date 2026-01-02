{0}6.1200 Problem Set 5
# Problem 1
## a)
{0}Collaborators: None
{0}Solver: Nathan Leung
{0}Sources Used: None
{0}Proof:
{bp_0}> Define a pulverizer state machine as described in the problem. Testing predicate $Q$ on the start state: 
{1}$Q(a, b, 1, 0, 0, 1)$
{1}$P_1(a, b) : gcd(a, b) = gcd(a, b) \quad \checkmark$
{1}$P_2(a, 1, 0) : (1)a + (0)b = a \quad \checkmark$
{1}$P_3(b, 0, 1) : (0)a + (1)b = b \quad \checkmark$
{1}Overall, $Q$ holds for the start state!
{bp_0}> Assume $Q(x, y, s, t, u, v)$ holds true, and initiate a transition to $(x', y', s', t', u', v') = (y, r, u, v, s - qu, t - qv)$
{bp_1}$\bullet$ $P_1(x', y') = P_1(y, r)$
{2}$gcd(y, r) = gcd(y, x \mod y) = gcd(x, y)$. $gcd(x, y) = gcd(a, b)$ from the assumption, so by the transitive property of equality $P_1$ holds true!
{bp_1}$\bullet$ $P_2(x', s', t') = P_2(y, u, v)$ which is $P_3(y, u, v)$ for the old state exactly, so $P_2$ holds true!
{bp_1}$\bullet$ $P_3(y', u', v') = P_3(r, s - qu, t - qv)$
{2}$(s - qu)a + (t - qv)b = sq + tb - q(ua + vb)$. By $P_2(x, s', t)$, $sa + tb = x$, and by $P_3(y, u, v)$, $ua + vb = y$. Thus $x - qy = (s - qu)a + (t - qv)b = r$, $P_3$ holds true!
{1}$P_1, P_2, P_3$ of the newly formed state are all satisfied, thus satisfying $Q$ for a state after transition. Thus, $Q$ is proven to be a preserved predicate $\square$
## b)
{0}Proof:
{bp_0}> Define a pulverizer state machine as described in the problem. By the first step of proof a), $Q$ holds true for the initial state. Additionally, by the conclusion of proof a) we conclude that $Q$ is a preserved predicate
{bp_0}> By the invariant principle $Q$ holds true when the state machine terminates. In the final state $y = 0$, so
{1}$P_1(x, 0) := gcd(x, 0) = gcd(a, b)$
{1}$P_2(x, s, t) := sa + tb = x$
{bp_0}> $gcd(a, b) = gcd(x, 0) = x = sa + tb$. Thus we conclude $s, t$ in the final state of the pulverizer satisfies Bezout's identity.
## c)
The pulverizer for variables $x, y$ follows the exact common transition of the Euclidean algorithm state machine $$(x, y) \rightarrow (y, x \rem y)$, to the pulverizer machine should terminate after at most the same number of transitions.
# Problem 2
{0}Collaborators: None
{0}Solver: Nathan Leung
{0}Sources Used: None
{0}$18062$ is not divisible by $11$ since $18062 \equiv (11)(1642)$. However, 2025 is not divisible by $11$ since $2025 \equiv 1 (mod 11)$. If $a$ and $b$ are arbitrary natural numbers, $11$ still divides $18062b$ since $18062b \equiv (11)(1642)(b) (mod 11)$ and from $2025 \equiv 1 (\mod 11)$ we get $2025^a \equiv 1^a (mod 11)$, $2025^a \equiv 1 (mod 11)$, $2025^a + 1 \equiv 2 (mod 11)$, so $2015^a + 1$ is not divisible by $11$, and thus cannot be equal to 18062b! $\square$
# Problem 5
{0}Collaborators: None
{0}Solver: Nathan Leung
{0}Sources Used: www.wolframalpha.com
## a)
{0}$n = (13139465087838462013)(16257701292567269201)$
{0}via factor n from wolframalpha
## b)
{0}$d \equiv e^{-1} \mod (p-1)(q-1)$ where $p$ and $q$ are the 2 primes calculated in $a$.
{0}$\equiv 172797418847783865496766528110570298807 (\mod \phi(n))$
{0}via wolframalpha
## c)
{0}$m \equiv \hat{m}^d (\mod n)$
{0}$\equiv 51734563350077735877145663 \mod n$
{0}via wolframalpha